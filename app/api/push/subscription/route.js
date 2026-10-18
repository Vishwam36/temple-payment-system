import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { validateSubscription } from '@/lib/push/validation'
import { NextResponse } from 'next/server'

// The owner is always the session user — never an ID from the request body.
async function getSessionUser() {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return error ? null : user
}

// POST /api/push/subscription — save (or re-bind) this browser's subscription to the
// signed-in user. Body: { subscription: PushSubscriptionJSON, oldEndpoint? }.
// Upserting on the unique endpoint means re-saving is idempotent, and on a shared
// browser the row moves to whoever is now signed in instead of duplicating.
export async function POST(request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { value, error } = validateSubscription(body.subscription)
  if (error) return NextResponse.json({ error }, { status: 400 })

  const admin = createAdminServerClient()
  const { error: upsertErr } = await admin.from('push_subscriptions').upsert({
    profile_id: user.id,
    endpoint: value.endpoint,
    p256dh: value.p256dh,
    auth: value.auth,
    user_agent: (request.headers.get('user-agent') || '').slice(0, 300) || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })
  if (upsertErr) return NextResponse.json({ error: 'Could not save subscription.' }, { status: 500 })

  // Browser rotated its subscription (pushsubscriptionchange): drop the old one.
  if (typeof body.oldEndpoint === 'string' && body.oldEndpoint !== value.endpoint) {
    await admin.from('push_subscriptions').delete().eq('endpoint', body.oldEndpoint).eq('profile_id', user.id)
  }

  return NextResponse.json({ success: true })
}

// DELETE /api/push/subscription — stop pushing to this browser for the signed-in user.
// Body: { endpoint }. Only ever deletes the caller's own row.
export async function DELETE(request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  if (typeof body.endpoint !== 'string' || body.endpoint.length > 2048) {
    return NextResponse.json({ error: 'endpoint is required' }, { status: 400 })
  }

  const admin = createAdminServerClient()
  const { error } = await admin.from('push_subscriptions').delete()
    .eq('endpoint', body.endpoint).eq('profile_id', user.id)
  if (error) return NextResponse.json({ error: 'Could not remove subscription.' }, { status: 500 })

  return NextResponse.json({ success: true })
}
