// Pure notification logic: who gets notified for a workflow event, and what they see.
// No I/O here — the dispatcher feeds in DB rows — so it is unit-tested directly
// (tests/push/*.test.mjs). Relative imports carry extensions so Node can load it too.
import { STATUS, STATUS_LABELS, STAGE_OWNER_ROLES, ROLES, ROLES_DB } from '../constants.js'

// Users authorised to act on a request sitting at `status` — the same rule as
// hasStageAuthority() in lib/utils.js, minus super_admin, which never gets routine
// notifications. Department COMs only count for their own department.
// `roleRows` are user_roles rows: { profile_id, role, department }.
export function resolveStageRecipientIds(roleRows, status, department) {
  const ownerRoles = STAGE_OWNER_ROLES[status] || []
  const ids = new Set()
  for (const r of roleRows || []) {
    if (!ownerRoles.includes(r.role)) continue
    if (r.role === ROLES_DB.department_com && r.department !== department) continue
    ids.add(r.profile_id)
  }
  return [...ids]
}

export const formatAmount = (amount) => {
  if (amount === null || amount === undefined || amount === '') return null
  const n = Number(amount)
  return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN')}` : null
}

// "your request for ₹5,000 (Guest House)" — amount lets the applicant tell requests apart.
const describeOwn = (req) => {
  const amount = formatAmount(req.amount)
  return `Your request${amount ? ` for ${amount}` : ''} (${req.department})`
}

// "Request for ₹5,000 from Guest House"
const describeForReviewer = (req, prefix = 'Request') => {
  const amount = formatAmount(req.amount)
  return `${prefix}${amount ? ` for ${amount}` : ''} from ${req.department}`
}

const stageLabel = (status) => ROLES[(STAGE_OWNER_ROLES[status] || [])[0]] || 'review'

// Applicant-facing message for a transition, or null when there is nothing to say.
export function applicantMessage({ from_status: from, to_status: to }, req, actorName) {
  const own = describeOwn(req)
  if (from === null || from === undefined) {
    return { title: 'Request Submitted', body: `${own} has been submitted successfully.` }
  }
  if (to === STATUS.PENDING_PA) {
    const by = actorName ? `${ROLES.department_com} (${actorName})` : ROLES.department_com
    return { title: 'Request Approved', body: `${own} has been approved by ${by}.` }
  }
  if (to === STATUS.PENDING_SUPERVISOR) {
    return { title: 'Request Approved', body: `${own} has been approved by the ${ROLES.passing_authority} and sent for verification.` }
  }
  if (to === STATUS.VERIFIED) {
    return from === STATUS.ON_HOLD
      ? { title: 'Hold Released', body: `${own} has been taken off hold, verified and forwarded to the ${ROLES.accounts_head} for payment.` }
      : { title: 'Request Verified', body: `${own} has been verified and forwarded to the ${ROLES.accounts_head} for payment.` }
  }
  if (to === STATUS.ON_HOLD) {
    return { title: 'Request On Hold', body: `${own} has been placed on hold. Click to view the reason.` }
  }
  if (to === STATUS.SUCCESSFUL) {
    return { title: 'Payment Successful', body: `Payment for ${own.charAt(0).toLowerCase()}${own.slice(1)} has been marked successful.` }
  }
  if (to === STATUS.REJECTED) {
    return from === STATUS.VERIFIED
      ? { title: 'Payment Rejected', body: `Payment for ${own.charAt(0).toLowerCase()}${own.slice(1)} has been rejected. Click to view details.` }
      : { title: 'Request Rejected', body: `${own} was rejected during ${stageLabel(from)} review. Click to view the reason.` }
  }
  if (STATUS_LABELS[to]) {
    return { title: 'Request Updated', body: `${own} is now: ${STATUS_LABELS[to]}.` }
  }
  return null
}

// Message for the users who must act next, or null when the new status needs no action
// from anyone new (on hold: the Supervisor placed it there; terminal statuses).
export function actionRequiredMessage({ from_status: from, to_status: to }, req, actorName) {
  switch (to) {
    case STATUS.PENDING_COM:
      return { title: 'New Request — Approval Required', body: `A new ${describeForReviewer(req, 'request')} requires your approval.` }
    case STATUS.PENDING_PA: {
      const by = actorName || ROLES.department_com
      return { title: 'Sanctioning Approval Required', body: `${describeForReviewer(req)} has been approved by ${by} and is awaiting your approval.` }
    }
    case STATUS.PENDING_SUPERVISOR:
      return { title: 'Verification Required', body: `${describeForReviewer(req)} is awaiting your verification.` }
    case STATUS.VERIFIED:
      return {
        title: 'Payment Confirmation Required',
        body: `${describeForReviewer(req)} has been verified${from === STATUS.ON_HOLD ? ' (released from hold)' : ''} and is awaiting payment confirmation.`,
      }
    default:
      return null
  }
}

// Builds the per-user notifications for one outbox event. One notification per user
// per event: a user who is both the applicant and a next-stage owner gets the
// action-required one (it links to the same request and is the one they must act on).
export function buildEventNotifications({ event, request, stageRoleRows, actorName }) {
  const url = `/requests/${request.id}`
  const tag = `request-${request.id}`
  // Identifies the transition, letting the service worker recognise a re-sent copy.
  const eventId = event.id
  const out = new Map()

  const action = actionRequiredMessage(event, request, actorName)
  if (action) {
    for (const userId of resolveStageRecipientIds(stageRoleRows, event.to_status, request.department)) {
      out.set(userId, { ...action, url, tag, eventId })
    }
  }

  const own = applicantMessage(event, request, actorName)
  if (own && request.applicant_id && !out.has(request.applicant_id)) {
    out.set(request.applicant_id, { ...own, url, tag, eventId })
  }

  return [...out].map(([userId, payload]) => ({ userId, payload }))
}

// Web Push `Topic` header (≤32 URL-safe chars): the push service replaces an undelivered
// message with a newer one of the same topic, so a re-sent copy of an event that is
// still queued (device offline) collapses into one instead of arriving twice.
export const pushTopic = (eventId) => String(eventId).replace(/[^A-Za-z0-9]/g, '').slice(0, 32)

// How to treat a push-service failure for one subscription.
//   gone  → subscription expired/unsubscribed: delete it
//   retry → transient (rate limit, push service down, network): try again later
//   drop  → permanent for this message (bad payload, VAPID mismatch): don't retry
export function classifyPushError(err) {
  const code = err?.statusCode
  if (code === 404 || code === 410) return 'gone'
  if (code === undefined || code === null || code === 429 || code >= 500) return 'retry'
  return 'drop'
}

export const MAX_ATTEMPTS = 5
const BACKOFF_SECONDS = [60, 300, 1800, 7200]

export function nextAttemptDelaySeconds(attempts) {
  return BACKOFF_SECONDS[Math.min(Math.max(attempts, 1), BACKOFF_SECONDS.length) - 1]
}
