import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { isUserGlobalScoper, getComDepartments } from '@/lib/utils'
import { NextResponse } from 'next/server'

// GET /api/history — visibility-filtered audit log Matrix
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminServerClient()

  // 1. Fetch all assigned roles and their respective department limits
  const { data: roleRows, error: roleErr } = await admin
    .from('user_roles')
    .select('role, department')
    .eq('profile_id', user.id)

  if (roleErr || !roleRows || roleRows.length === 0) {
    return NextResponse.json({ error: 'No authorization parameters found for this profile.' }, { status: 403 })
  }

  // 2. Classify permissions across the user's role array footprint
  const isGlobalScoper = isUserGlobalScoper(roleRows)
  const comDepartments = getComDepartments(roleRows)

  // Base structured inner join query
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

  // ── DYNAMIC HISTORY VISIBILITY FILTERS ──────────────────────────

  if (!isGlobalScoper) {
    // If the user has COM privileges for specific departments, they can see logs for those departments 
    // OR see logs for any request they personally applied for.
    if (comDepartments.length > 0) {
      query = query.or(
        `applicant_id.eq.${user.id},department.in.(${comDepartments.join(',')})`,
        { foreignTable: 'payment_requests' }
      )
    } else {
      // Regular applicant footprint — restricted to their own submitted lines
      query = query.eq('payment_requests.applicant_id', user.id)
    }
  }
  // If isGlobalScoper is true, filters are completely bypassed (Full Audit Visibility)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ history: data })
}