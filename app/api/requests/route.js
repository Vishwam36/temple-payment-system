import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { isUserGlobalScoper, getComDepartments } from '@/lib/utils'
import { ACCOUNT_NO_REGEX, IFSC_CODE_REGEX } from '@/lib/constants'
import { NextResponse } from 'next/server'

// 1. GET /api/requests — role-filtered matrix visibility list
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminServerClient()

  // Fetch all authorization rows assigned to this user
  const { data: roleRows, error: roleErr } = await admin
    .from('user_roles')
    .select('role, department')
    .eq('profile_id', user.id)

  if (roleErr || !roleRows || roleRows.length === 0) {
    return NextResponse.json({ error: 'No authorization parameters found for this profile.' }, { status: 403 })
  }

  // Map roles and isolate list of managed departments
  const isGlobalScoper = isUserGlobalScoper(roleRows)
  const comDepartments = getComDepartments(roleRows)

  // Base Query
  let query = admin
    .from('payment_requests')
    .select(`*, applicant:profiles!applicant_id(full_name, email)`)
    .order('created_at', { ascending: false })

  // ── MATRIX VISIBILITY RULES ──────────────────────────────────
  if (!isGlobalScoper) {
    if (comDepartments.length > 0) {
      // User can see requests they personally applied for OR requests from departments they manage
      query = query.or(`applicant_id.eq.${user.id},department.in.(${comDepartments.join(',')})`)
    } else {
      // Standard applicant fallback boundary
      query = query.eq('applicant_id', user.id)
    }
  }
  // PA, AH, super_admin: Bypasses filters entirely — sees everything

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data })
}

// 2. POST /api/requests — create new request entry 
export async function POST(request) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { department, purpose, amount, receiver_account_no, receiver_ifsc_code, receiver_account_holder } = body

  if (!department || !purpose || !amount || !receiver_account_no || !receiver_ifsc_code || !receiver_account_holder) {
    return NextResponse.json({ error: 'department, purpose, amount, receiver account number, IFSC code and account holder name are required fields' }, { status: 400 })
  }

  const normalizedIfsc = receiver_ifsc_code.trim().toUpperCase()

  if (!ACCOUNT_NO_REGEX.test(receiver_account_no.trim())) {
    return NextResponse.json({ error: 'Receiver account number must be numeric (6-20 digits).' }, { status: 400 })
  }
  if (!IFSC_CODE_REGEX.test(normalizedIfsc)) {
    return NextResponse.json({ error: 'Receiver IFSC code format is invalid.' }, { status: 400 })
  }

  const admin = createAdminServerClient()

  // Create request entry
  const { data: newReq, error: reqErr } = await admin
    .from('payment_requests')
    .insert({
      applicant_id: user.id,
      department,
      purpose,
      amount: amount || null,
      receiver_account_no: receiver_account_no.trim(),
      receiver_ifsc_code: normalizedIfsc,
      receiver_account_holder: receiver_account_holder.trim()
    })
    .select()
    .single()

  if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 })

  return NextResponse.json({ request: newReq }, { status: 201 })
}