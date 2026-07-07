import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { APPROVE_TRANSITIONS } from '@/lib/constants'

export async function POST(request, context) {
  // 1. Unwrap dynamic route parameters
  const params = await context.params
  const requestId = params.id

  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminServerClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Fetch current request status
  const { data: req, error: reqErr } = await admin
    .from('payment_requests').select('status').eq('id', requestId).single()
  if (reqErr || !req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  // 2. Fetch the transition rule configuration matching the user's role
  const roleWorkflow = APPROVE_TRANSITIONS[profile.role]
  if (!roleWorkflow) return NextResponse.json({ error: 'Your role cannot approve requests' }, { status: 403 })

  // 3. Direct lookup by the request's current status (since all workflow entries are now nested)
  const transition = roleWorkflow[req.status]
  if (!transition) {
    return NextResponse.json({ error: 'Your role cannot approve this request at its current stage' }, { status: 403 })
  }

  // 4. State machine alignment guardrail validation
  if (req.status !== transition.from) { 
    return NextResponse.json({ error: `Cannot approve: request is "${req.status}", expected "${transition.from}"` }, { status: 409 })
  }

  // Parse payload 
  const body = await request.json().catch(() => ({}))
  const updatePayload = { status: transition.to }
  if (body.sender_account !== undefined) updatePayload.sender_account = body.sender_account

  // Advance workflow state
  const { error: updateErr } = await admin
    .from('payment_requests').update(updatePayload).eq('id', requestId)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Append entry to immutable historic ledger row
  await admin.from('request_history').insert({
    request_id: requestId,
    actor_id: user.id,
    action: transition.action,
    sender_account_set: body.sender_account || null,
  })

  return NextResponse.json({ success: true, new_status: transition.to })
}