import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
  const roles = roleRows.map(r => r.role)
  const isGlobalScoper = roles.some(r => ['super_admin', 'accounts_head', 'passing_authority'].includes(r))
  const comDepartments = roleRows.filter(r => r.role === 'department_com' && r.department).map(r => r.department)

  // Explicit access boundary checks
  const isOwner = req.applicant_id === user.id
  const isDeptComForThisReq = comDepartments.includes(req.department)

  if (!isGlobalScoper && !isOwner && !isDeptComForThisReq) {
    return NextResponse.json({ error: 'Forbidden: You do not have permission to view this request.' }, { status: 403 })
  }

  return NextResponse.json({ request: req })
}