import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { APPROVE_TRANSITIONS } from '@/lib/constants'

export async function PATCH(request, { params }) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminServerClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const transition = APPROVE_TRANSITIONS[profile.role]
  if (!transition) return NextResponse.json({ error: 'Your role cannot approve requests' }, { status: 403 })

  // Fetch current request
  const { data: req, error: reqErr } = await admin
    .from('payment_requests').select('status').eq('id', params.id).single()
  if (reqErr || !req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  // State machine check
  if (req.status !== transition.from) {
    return NextResponse.json({ error: `Cannot approve: request is "${req.status}", expected "${transition.from}"` }, { status: 409 })
  }

  // Optional sender_account from body
  const body = await request.json().catch(() => ({}))
  const updatePayload = { status: transition.to }
  if (body.sender_account !== undefined) updatePayload.sender_account = body.sender_account

  // Advance status
  const { error: updateErr } = await admin
    .from('payment_requests').update(updatePayload).eq('id', params.id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Immutable audit row
  await admin.from('request_history').insert({
    request_id: params.id,
    actor_id: user.id,
    action: transition.action,
    sender_account_set: body.sender_account || null,
  })

  return NextResponse.json({ success: true, new_status: transition.to })
}
