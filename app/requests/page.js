// app/requests/page.js

import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RequestTable from '@/components/requests/RequestTable'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getUserRolesAndScopes, isUserGlobalScoper, getComDepartments, isGlobalScoper } from '@/lib/utils'

export default async function RequestsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminServerClient()

  // 1. Fetch user role configurations from the many-to-many junction table
  const roleRows = await getUserRolesAndScopes(user.id)

  const isGlobalScoper = isUserGlobalScoper(roleRows)
  const comDepartments = getComDepartments(roleRows)

  // 2. Build Base Request Selection Query (Including account data tracking links)
  let query = admin
    .from('payment_requests')
    .select('id, status, department, purpose, amount, created_at, applicant_id, receiver_account, sender_account')
    .order('created_at', { ascending: false })

  // ── MATRIX VISIBILITY RULES ──────────────────────────────────
  if (!isGlobalScoper) {
    if (comDepartments.length > 0) {
      // User can see requests they personally applied for OR requests from departments they manage
      query = query.or(`applicant_id.eq.${user.id},department.in.(${comDepartments.join(',')})`)
    } else {
      // Standard applicant container isolation
      query = query.eq('applicant_id', user.id)
    }
  }
  // PA, AH, super_admin: Bypasses filters entirely — sees everything

  const { data: requests = [] } = await query

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold gradient-text">Payment Requests</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {isGlobalScoper
              ? 'All department requests'
              : comDepartments.length > 0
                ? 'Requests for your managed departments & personal submissions'
                : 'Your submitted requests'}
          </p>
        </div>
        <Link href="/requests/new" className="btn-primary">
          <Plus size={16} /> New Request
        </Link>
      </div>

      {/* Table handles mapping account indicators alongside data items */}
      <RequestTable requests={requests} />
    </div>
  )
}