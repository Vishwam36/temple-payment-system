import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { REJECT_TRANSITIONS } from '@/lib/constants'

export async function POST(request, context) {
  // 1. Unwrap the asynchronous params
  const params = await context.params
  const requestId = params.id

  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminServerClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Fetch current request status
  const { data: req } = await admin.from('payment_requests').select('status').eq('id', requestId).single()
  if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  // 2. Fetch the transition rule configuration matching the user's role
  const roleWorkflow = REJECT_TRANSITIONS[profile.role]
  if (!roleWorkflow) return NextResponse.json({ error: 'Your role cannot reject requests' }, { status: 403 })

  // 3. Direct lookup by the request's current status
  const transition = roleWorkflow[req.status]
  if (!transition) {
    return NextResponse.json({ error: 'Your role cannot reject this request at its current stage' }, { status: 403 })
  }

  // 4. Strict state machine validation check
  if (req.status !== transition.from) {
    return NextResponse.json({ error: `Cannot reject: request is "${req.status}", expected "${transition.from}"` }, { status: 409 })
  }

  const body = await request.json().catch(() => ({}))

  // Mark request as rejected
  const { error: updateErr } = await admin
    .from('payment_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)
    
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Immutable audit row with optional reason
  await admin.from('request_history').insert({
    request_id: requestId,
    actor_id: user.id,
    action: transition.action,
    reason: body.reason || null,
  })

  return NextResponse.json({ success: true, new_status: 'rejected' })
}