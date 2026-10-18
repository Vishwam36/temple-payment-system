// Server-only Web Push delivery. Workflow transitions never call web-push directly:
// a DB trigger writes one push_events outbox row per transition, in the same
// transaction as the status change, and this module delivers it immediately after
// the response via next/server `after()` (tracked by Vercel's waitUntil, so it is
// not cut off when the response returns). No scheduled job is involved.
//
// Duplicate prevention: one event per transition (unique index); one delivery row
// per (event, recipient, subscription), claimed atomically and never re-sent once
// 'sent'. The only residual duplicate risk is a dispatcher dying after the push
// service accepted a message but before recording 'sent'; a later run then re-sends
// it. The Topic header and the service worker's per-event check make such a re-send
// replace the first notification silently rather than show a second alert.
import webpush from 'web-push'
import { after } from 'next/server'
import { createAdminServerClient } from '@/lib/supabase/server'
import { STAGE_OWNER_ROLES } from '@/lib/constants'
import {
  buildEventNotifications, classifyPushError, MAX_ATTEMPTS, nextAttemptDelaySeconds, pushTopic
} from '@/lib/push/messages'

const PUSH_TTL_SECONDS = 24 * 60 * 60
const EVENT_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000 // stale alerts are noise, not news
const PROCESSED_RETENTION_DAYS = 30
// Quick retries inside the same invocation for transient push-service errors, so a
// momentary blip does not delay the notification until some later run.
const INLINE_RETRY_DELAYS_MS = [1000, 3000]

let vapidReady = null
function ensureVapid() {
  if (vapidReady !== null) return vapidReady
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) {
    console.warn('[push] VAPID keys not configured; push delivery disabled (events stay queued).')
    vapidReady = false
  } else {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    vapidReady = true
  }
  return vapidReady
}

// Called by the request routes after a successful transition. Never throws and never
// blocks the response: push problems must not affect the approval itself.
export function schedulePushDispatch(requestId) {
  after(async () => {
    try {
      // 1. This transition, right now.
      await dispatchPushEvents({ requestId, limit: 5 })
      // 2. Recovery: anything older still unsent (an earlier invocation that crashed or
      //    hit a transient failure). Only unsent deliveries are ever claimed.
      await dispatchPushEvents({ limit: 10, minAgeSeconds: 30 })
      await purgeProcessedPushEvents()
    } catch (err) {
      console.error('[push] dispatch failed', err)
    }
  })
}

// The outbox row is written by a trigger that cannot see the app user, so the route
// stamps who acted (used for "approved by <COM name>"). Best effort: on failure the
// message simply falls back to the role name.
export async function recordPushActor(requestId, toStatus, actorId) {
  try {
    const admin = createAdminServerClient()
    await admin.from('push_events').update({ actor_id: actorId })
      .eq('request_id', requestId).eq('to_status', toStatus)
      .is('actor_id', null).is('processed_at', null)
  } catch (err) {
    console.error('[push] could not record actor', err)
  }
}

export async function dispatchPushEvents({ requestId = null, limit = 20, minAgeSeconds = 0 } = {}) {
  if (!ensureVapid()) return { processed: 0, skipped: 'vapid-not-configured' }

  const admin = createAdminServerClient()
  const { data: events, error } = await admin.rpc('claim_push_events', {
    p_limit: limit, p_request_id: requestId, p_min_age_seconds: minAgeSeconds,
  })
  if (error) {
    console.error('[push] claim failed', error)
    return { processed: 0, error: error.message }
  }

  for (const event of events || []) {
    try {
      await processEvent(admin, event)
    } catch (err) {
      console.error(`[push] event ${event.id} failed`, err)
      await settleEvent(admin, event, { retry: true, lastError: String(err?.message || err) })
    }
  }
  return { processed: events?.length || 0 }
}

export async function purgeProcessedPushEvents() {
  const admin = createAdminServerClient()
  const cutoff = new Date(Date.now() - PROCESSED_RETENTION_DAYS * 86400000).toISOString()
  const { error } = await admin.from('push_events').delete().not('processed_at', 'is', null).lt('processed_at', cutoff)
  if (error) console.error('[push] purge failed', error)
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function sendWithInlineRetry(sub, payload, topic) {
  for (let attempt = 0; ; attempt++) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: PUSH_TTL_SECONDS, urgency: 'high', topic, timeout: 10000 }
      )
      return { outcome: 'sent' }
    } catch (err) {
      const kind = classifyPushError(err)
      const error = `${err?.statusCode || 'network'}: ${String(err?.body || err?.message || err).slice(0, 300)}`
      if (kind !== 'retry' || attempt >= INLINE_RETRY_DELAYS_MS.length) return { outcome: kind, error }
      await sleep(INLINE_RETRY_DELAYS_MS[attempt])
    }
  }
}

async function processEvent(admin, event) {
  if (Date.now() - new Date(event.created_at).getTime() > EVENT_MAX_AGE_MS) {
    return settleEvent(admin, event, { lastError: 'expired before delivery' })
  }

  const { data: request, error: reqErr } = await admin
    .from('payment_requests').select('id, applicant_id, department, amount')
    .eq('id', event.request_id).maybeSingle()
  if (reqErr) throw reqErr
  if (!request) return settleEvent(admin, event, { lastError: 'request not found' })

  const ownerRoles = STAGE_OWNER_ROLES[event.to_status] || []
  const [stageRes, actorRes] = await Promise.all([
    ownerRoles.length
      ? admin.from('user_roles').select('profile_id, role, department').in('role', ownerRoles)
      : Promise.resolve({ data: [] }),
    event.actor_id
      ? admin.from('profiles').select('full_name').eq('id', event.actor_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  if (stageRes.error) throw stageRes.error

  const notifications = buildEventNotifications({
    event, request, stageRoleRows: stageRes.data || [], actorName: actorRes.data?.full_name || null,
  })
  if (notifications.length === 0) return settleEvent(admin, event, {})

  const payloadByUser = new Map(notifications.map(n => [n.userId, JSON.stringify(n.payload)]))
  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions').select('id, profile_id, endpoint, p256dh, auth')
    .in('profile_id', [...payloadByUser.keys()])
  if (subErr) throw subErr
  if (!subs?.length) return settleEvent(admin, event, {})

  // Claim only deliveries not already sent/failed and not in flight elsewhere.
  const { data: claimedRows, error: claimErr } = await admin.rpc('claim_push_deliveries', {
    p_event_id: event.id,
    p_recipient_ids: subs.map(s => s.profile_id),
    p_subscription_ids: subs.map(s => s.id),
  })
  if (claimErr) throw claimErr
  const claimed = new Set((claimedRows || []).map(r => r.subscription_id))

  const topic = pushTopic(event.id)
  const results = await Promise.all(subs.filter(s => claimed.has(s.id)).map(async (s) => ({
    sub: s, ...(await sendWithInlineRetry(s, payloadByUser.get(s.profile_id), topic)),
  })))

  const byOutcome = (o) => results.filter(r => r.outcome === o)
  const nowIso = new Date().toISOString()
  const mark = (rows, patch) => rows.length
    ? admin.from('push_deliveries').update({ locked_until: null, ...patch })
        .eq('event_id', event.id).in('subscription_id', rows.map(r => r.sub.id))
    : Promise.resolve({})

  const giveUp = event.attempts >= MAX_ATTEMPTS
  const retryRows = byOutcome('retry')
  const markResults = await Promise.all([
    mark(byOutcome('sent'), { status: 'sent', sent_at: nowIso, last_error: null }),
    mark(byOutcome('drop'), { status: 'failed', last_error: byOutcome('drop')[0]?.error }),
    mark(retryRows, { status: giveUp ? 'failed' : 'retry', last_error: retryRows[0]?.error }),
  ])
  markResults.forEach(r => r.error && console.error('[push] could not record delivery state', r.error))

  // Expired/unsubscribed browsers: remove them (their delivery rows go with them).
  const gone = byOutcome('gone')
  if (gone.length) {
    const { error } = await admin.from('push_subscriptions').delete().in('id', gone.map(r => r.sub.id))
    if (error) console.error('[push] could not delete expired subscriptions', error)
  }

  // Deliveries still in flight in another dispatcher, or set to retry, keep the event open.
  const { count: openCount } = await admin.from('push_deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', event.id).in('status', ['retry', 'sending'])

  const lastError = [...retryRows, ...byOutcome('drop'), ...gone][0]?.error || null
  return settleEvent(admin, event, { retry: (openCount || 0) > 0, lastError })
}

// Either schedules a retry (releasing the lease) or marks the event done.
async function settleEvent(admin, event, { retry = false, lastError = null }) {
  const patch = { locked_until: null, last_error: lastError }
  if (retry && event.attempts < MAX_ATTEMPTS) {
    patch.next_attempt_at = new Date(Date.now() + nextAttemptDelaySeconds(event.attempts) * 1000).toISOString()
  } else {
    patch.processed_at = new Date().toISOString()
  }
  const { error } = await admin.from('push_events').update(patch).eq('id', event.id)
  if (error) console.error(`[push] could not settle event ${event.id}`, error)
}
