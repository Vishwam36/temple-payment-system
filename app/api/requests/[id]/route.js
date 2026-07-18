import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  isUserGlobalScoper, getComDepartments, hasStageAuthority, getUserRolesAndScopes,
  getMatchingRoleRow, composeStatusNote
} from '@/lib/utils'
import {
  STATUS_TRANSITIONS, STATUS_ACTIONS, SENDER_ACCOUNT_ACTIONS, STATUS, ROLES,
  HOLD_REASON_MIN_LENGTH, REJECTION_REASON_MIN_LENGTH, ACCOUNT_NO_REGEX, IFSC_CODE_REGEX
} from '@/lib/constants'

export async function GET(request, context) {
  // 1. Unwrap dynamic route parameters safely
  const params = await context.params
  const requestId = params.id

  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminServerClient()

  // 2. Fetch the target payment request detail record
  const { data: req, error: reqErr } = await admin
    .from('payment_requests')
    .select(`*, applicant:profiles!applicant_id(full_name, email)`)
    .eq('id', requestId)
    .single()

  if (reqErr || !req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  // 3. Gather all role mappings and boundaries for the calling client profile
  const { data: roleRows, error: roleErr } = await admin
    .from('user_roles')
    .select('role, department')
    .eq('profile_id', user.id)

  if (roleErr || !roleRows || roleRows.length === 0) {
    return NextResponse.json({ error: 'No authorization parameters found for your profile.' }, { status: 403 })
  }

  // 4. Evaluate access containment parameters
  const isGlobalScoper = isUserGlobalScoper(roleRows)
  const comDepartments = getComDepartments(roleRows)

  // Explicit access boundary checks
  const isOwner = req.applicant_id === user.id
  const isDeptComForThisReq = comDepartments.includes(req.department)

  if (!isGlobalScoper && !isOwner && !isDeptComForThisReq) {
    return NextResponse.json({ error: 'Forbidden: You do not have permission to view this request.' }, { status: 403 })
  }

  return NextResponse.json({ request: req })
}

// PATCH /api/requests/[id] — advance the request's status through the approval pipeline.
// Body: { status: <target status>, sender_account_no?, sender_ifsc_code?, sender_account_holder?, hold_reason?, rejection_reason? }
export async function PATCH(request, context) {
  const params = await context.params
  const requestId = params.id

  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminServerClient()

  // 1. Fetch target payment request to look up department and current status
  const { data: req, error: reqErr } = await admin
    .from('payment_requests').select('status, department').eq('id', requestId).single()
  if (reqErr || !req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  // 2. Fetch all assigned user roles and scope records from the junction matrix
  const roleRows = await getUserRolesAndScopes(user.id)
  if (!roleRows || roleRows.length === 0) {
    return NextResponse.json({ error: 'No active role permissions mapped to your profile.' }, { status: 403 })
  }

  // 3. Only the role(s) that own the current stage may act on it
  if (!hasStageAuthority(roleRows, req.status, req.department)) {
    return NextResponse.json({
      error: `Forbidden: You do not have permission to update this request at its current stage.`
    }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const {
    status: targetStatus, sender_account_no, sender_ifsc_code, sender_account_holder,
    hold_reason, rejection_reason
  } = body

  // 4. Strict directional state-machine validation
  const allowedTargets = STATUS_TRANSITIONS[req.status] || []
  if (!targetStatus || !allowedTargets.includes(targetStatus)) {
    return NextResponse.json({
      error: `Cannot move request from "${req.status}" to "${targetStatus || '(none)'}"`
    }, { status: 409 })
  }

  // 5. Hold reason is required (and must meet the minimum length) when placing on hold
  if (targetStatus === STATUS.ON_HOLD) {
    if (!hold_reason || hold_reason.trim().length < HOLD_REASON_MIN_LENGTH) {
      return NextResponse.json({
        error: `A hold reason of at least ${HOLD_REASON_MIN_LENGTH} characters is required.`
      }, { status: 400 })
    }
  }

  // 5b. A rejection comment is compulsory, no matter which stage the rejection happens at
  if (targetStatus === STATUS.REJECTED) {
    if (!rejection_reason || rejection_reason.trim().length < REJECTION_REASON_MIN_LENGTH) {
      return NextResponse.json({
        error: `A rejection reason of at least ${REJECTION_REASON_MIN_LENGTH} characters is required.`
      }, { status: 400 })
    }
  }

  // Sender (debit) account may only be attached on approve/verify transitions, never hold/reject
  const matchedAction = (STATUS_ACTIONS[req.status] || []).find(a => a.target === targetStatus)
  const isSenderAccountAction = matchedAction && SENDER_ACCOUNT_ACTIONS.includes(matchedAction.action)

  const updatePayload = { status: targetStatus }

  // Hold/reject notes name the acting user and role so the applicant knows who to
  // follow up with, plus a standard closing line telling them what to do next.
  if (targetStatus === STATUS.ON_HOLD || targetStatus === STATUS.REJECTED) {
    const { data: actorProfile } = await admin.from('profiles').select('full_name, email').eq('id', user.id).single()
    const actorName = actorProfile?.full_name || actorProfile?.email || 'Unknown User'
    const actingRoleRow = getMatchingRoleRow(roleRows, req.department)
    const actorRoleLabel = ROLES[actingRoleRow?.role] || actingRoleRow?.role || 'Unknown Role'

    if (targetStatus === STATUS.ON_HOLD) {
      updatePayload.hold_reason = composeStatusNote({
        headerVerb: 'placed on hold',
        reason: hold_reason.trim(),
        actorLabel: actorRoleLabel,
        actorName,
        closingLine: 'Please reach out to accounts team to resolve the issue.'
      })
    }

    if (targetStatus === STATUS.REJECTED) {
      updatePayload.rejection_reason = composeStatusNote({
        headerVerb: 'rejected',
        reason: rejection_reason.trim(),
        actorLabel: actorRoleLabel,
        actorName,
        closingLine: `Please reach out to ${actorRoleLabel} (${actorName}) and place a new request.`
      })
    }
  }

  if (isSenderAccountAction) {
    const anyProvided = sender_account_no !== undefined || sender_ifsc_code !== undefined || sender_account_holder !== undefined
    if (anyProvided) {
      if (!sender_account_no || !sender_ifsc_code || !sender_account_holder) {
        return NextResponse.json({
          error: 'Sender account number, IFSC code and account holder name must all be provided together.'
        }, { status: 400 })
      }

      const normalizedIfsc = sender_ifsc_code.trim().toUpperCase()

      if (!ACCOUNT_NO_REGEX.test(sender_account_no.trim())) {
        return NextResponse.json({ error: 'Sender account number must be numeric (6-20 digits).' }, { status: 400 })
      }
      if (!IFSC_CODE_REGEX.test(normalizedIfsc)) {
        return NextResponse.json({ error: 'Sender IFSC code format is invalid.' }, { status: 400 })
      }

      updatePayload.sender_account_no = sender_account_no.trim()
      updatePayload.sender_ifsc_code = normalizedIfsc
      updatePayload.sender_account_holder = sender_account_holder.trim()
    }
  }

  // 6. Advance workflow state
  const { error: updateErr } = await admin
    .from('payment_requests').update(updatePayload).eq('id', requestId)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ success: true, status: targetStatus })
}
