import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/history — visibility-filtered audit log
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminServerClient()
  const { data: profile } = await admin.from('profiles').select('role,department').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Base query
  let query = admin
    .from('request_history')
    .select(`
      *,
      payment_requests!inner (
        id, purpose, department, amount, status, applicant_id,
        applicant:profiles!applicant_id ( full_name, email )
      ),
      actor:profiles!actor_id ( full_name, email )
    `)
    .order('created_at', { ascending: false })

  // ── HISTORY VISIBILITY RULES ──────────────────────────────────
  if (profile.role === 'applicant') {
    // Only history rows where the request was created by this user
    query = query.eq('payment_requests.applicant_id', user.id)

  } else if (profile.role === 'department_com') {
    // Only history for requests in this COM's department
    query = query.eq('payment_requests.department', profile.department)
  }
  // passing_authority, accounts_head, super_admin → full visibility (no filter)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ history: data })
}
