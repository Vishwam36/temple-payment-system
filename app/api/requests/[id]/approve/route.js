import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { APPROVE_TRANSITIONS, ROLES_DB } from '@/lib/constants'

export async function POST(request, context) {
  // 1. Unwrap dynamic route parameters safely
  const params = await context.params
  const requestId = params.id

  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminServerClient()

  // 2. Fetch target payment request to look up department and status parameters
  const { data: req, error: reqErr } = await admin
    .from('payment_requests').select('status, department').eq('id', requestId).single()
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
  // Checks if user has global approval clearance or explicit COM authority for this request's department
  const matchingRoleRow = roleRows.find(r => {
    if ([ROLES_DB.super_admin, ROLES_DB.accounts_head, ROLES_DB.passing_authority].includes(r.role)) return true
    if (r.role === ROLES_DB.department_com && r.department === req.department) return true
    return false
  })

  if (!matchingRoleRow) {
    return NextResponse.json({
      error: `Forbidden: You do not have permission to process approvals for the "${req.department}" department.`
    }, { status: 403 })
  }

  // 5. Fetch transition rule dictionary block from static workflow mappings
  const roleWorkflow = APPROVE_TRANSITIONS[matchingRoleRow.role]
  const transition = roleWorkflow ? roleWorkflow[req.status] : null

  if (!transition) {
    return NextResponse.json({ error: 'Your role cannot approve this request at its current stage' }, { status: 403 })
  }

  // 6. State machine alignment validation check
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