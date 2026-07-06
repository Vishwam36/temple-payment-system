import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/requests — role-filtered list
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminServerClient()
  const { data: profile } = await admin.from('profiles').select('role,department').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  let query = admin
    .from('payment_requests')
    .select(`*, applicant:profiles!applicant_id(full_name,email)`)
    .order('created_at', { ascending: false })

  if (profile.role === 'applicant') {
    query = query.eq('applicant_id', user.id)
  } else if (profile.role === 'department_com') {
    query = query.eq('department', profile.department)
  }
  // PA, AH, super_admin: no filter — see all

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ requests: data })
}

// POST /api/requests — create new request
export async function POST(request) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { department, purpose, amount, sender_account } = body

  if (!department || !purpose) {
    return NextResponse.json({ error: 'department and purpose are required' }, { status: 400 })
  }

  const admin = createAdminServerClient()

  // Create request
  const { data: newReq, error: reqErr } = await admin
    .from('payment_requests')
    .insert({ applicant_id: user.id, department, purpose, amount: amount || null, sender_account: sender_account || null })
    .select()
    .single()

  if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 })

  // Insert immutable history row
  await admin.from('request_history').insert({
    request_id: newReq.id,
    actor_id: user.id,
    action: 'submitted',
  })

  return NextResponse.json({ request: newReq }, { status: 201 })
}
