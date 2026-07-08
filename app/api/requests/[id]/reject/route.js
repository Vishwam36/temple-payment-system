// app/api/requests/[id]/reject/route.js

import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { REJECT_TRANSITIONS } from '@/lib/constants'

export async function POST(request, context) {
  // 1. Unwrap the asynchronous params safely
  const params = await context.params
  const requestId = params.id

  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminServerClient()

  // 2. Fetch current request status and department parameters
  const { data: req, error: reqErr } = await admin
    .from('payment_requests')
    .select('status, department')
    .eq('id', requestId)
    .single()
  if (reqErr || !req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  // 3. Fetch all assigned user roles and scope records from the junction matrix
  const { data: roleRows, error: roleErr } = await admin
    .from('user_roles')
    .select('role, department')
    .eq('profile_id', user.id)

  if (roleErr || !roleRows || roleRows.length === 0) {
    return NextResponse.json({ error: 'No active role permissions mapped to your profile.' }, { status: 403 })
  }

  // 4. Resolve the matching execution authorization rule row
  // Verifies global rejection clearance or matching department COM boundaries
  const matchingRoleRow = roleRows.find(r => {
    if (['super_admin', 'accounts_head', 'passing_authority'].includes(r.role)) return true
    if (r.role === 'department_com' && r.department === req.department) return true
    return false
  })

  if (!matchingRoleRow) {
    return NextResponse.json({
      error: `Forbidden: You do not have permission to reject requests for the "${req.department}" department.`
    }, { status: 403 })
  }

  // 5. Fetch transition rule configuration matching the verified executing role
  const roleWorkflow = REJECT_TRANSITIONS[matchingRoleRow.role]
  const transition = roleWorkflow ? roleWorkflow[req.status] : null

  if (!transition) {
    return NextResponse.json({ error: 'Your role cannot reject this request at its current stage' }, { status: 403 })
  }

  // 6. Strict state machine validation check
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