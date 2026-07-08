// app/dashboard/page.js

import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ROLES } from '@/lib/constants'
import { FileText, Clock, CheckCircle, XCircle, Plus } from 'lucide-react'

export const metadata = { title: 'Dashboard — Temple Payment System' }

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminServerClient()

  // 1. Concurrent Fetch: Get baseline profile metadata and full user role matrix maps
  const [profileRes, rolesRes] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', user.id).single(),
    admin.from('user_roles').select('role, department').eq('profile_id', user.id)
  ])

  const profile = profileRes.data
  const roleRows = rolesRes.data || []

  // 2. Map and parse dynamic permission boundaries
  const roles = roleRows.map(r => r.role)
  const uniqueRoles = Array.from(new Set(roles))
  const isGlobalScoper = roles.some(r => ['super_admin', 'accounts_head', 'passing_authority'].includes(r))
  const comDepartments = roleRows.filter(r => r.role === 'department_com' && r.department).map(r => r.department)

  // 3. Assemble dynamic analytics tracking visibility selection rules
  let query = admin.from('payment_requests').select('id, status, department, purpose, amount, created_at')

  if (!isGlobalScoper) {
    if (comDepartments.length > 0) {
      // User can see requests they personally applied for OR requests from departments they manage
      query = query.or(`applicant_id.eq.${user.id},department.in.(${comDepartments.join(',')})`)
    } else {
      // Fallback applicant visibility container boundaries
      query = query.eq('applicant_id', user.id)
    }
  }

  const { data } = await query.order('created_at', { ascending: false }).limit(50)
  const requests = data || []

  // 4. Calculate stats over visibility array scope
  const stats = {
    total: requests.length,
    pending: requests.filter(r => ['pending_com', 'pending_pa', 'pending_ah'].includes(r.status)).length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }

  const recent = requests.slice(0, 5)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold gradient-text">
            Hare Krishna, {profile?.full_name?.split(' ')[0] || 'User'} 🙏
          </h1>
          <div className="text-sm mt-1 flex flex-wrap items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            {uniqueRoles.map(r => (
              <span key={r} className="badge badge-gold">{ROLES[r] || r}</span>
            ))}
            {comDepartments.length > 0 && (
              <span>· Managing: {comDepartments.join(', ')}</span>
            )}
          </div>
        </div>
        <Link href="/requests/new" className="btn-primary">
          <Plus size={16} /> New Request
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,166,35,0.1)' }}>
              <FileText size={16} style={{ color: 'var(--gold)' }} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Total</span>
          </div>
          <div className="text-3xl font-bold" style={{ color: 'var(--gold)' }}>{stats.total}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>All requests</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
              <Clock size={16} style={{ color: '#FCD34D' }} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Pending</span>
          </div>
          <div className="text-3xl font-bold" style={{ color: '#FCD34D' }}>{stats.pending}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Awaiting approval</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)' }}>
              <CheckCircle size={16} style={{ color: '#6EE7B7' }} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Approved</span>
          </div>
          <div className="text-3xl font-bold" style={{ color: '#6EE7B7' }}>{stats.approved}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Successful</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <XCircle size={16} style={{ color: '#FCA5A5' }} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Rejected</span>
          </div>
          <div className="text-3xl font-bold" style={{ color: '#FCA5A5' }}>{stats.rejected}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Declined</div>
        </div>
      </div>

      {/* Recent requests */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'rgba(245,166,35,0.1)' }}>
          <h2 className="font-bold text-sm" style={{ color: 'var(--text-secondary)' }}>RECENT REQUESTS</h2>
          <Link href="/requests" className="text-xs hover:underline" style={{ color: 'var(--gold)' }}>View all →</Link>
        </div>

        {recent.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p style={{ color: 'var(--text-muted)' }}>No requests yet</p>
            <Link href="/requests/new" className="btn-primary mt-4 inline-flex"><Plus size={14} /> Create first request</Link>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Department</th><th>Purpose</th><th>Amount</th><th>Status</th><th>Date</th><th></th></tr>
                </thead>
                <tbody>
                  {recent.map(r => (
                    <tr key={r.id}>
                      <td><span className="badge badge-gold">{r.department}</span></td>
                      <td className="max-w-xs"><span className="text-sm line-clamp-1">{r.purpose}</span></td>
                      <td>{r.amount ? <span style={{ color: 'var(--gold)', fontWeight: 600 }}>₹{Number(r.amount).toLocaleString('en-IN')}</span> : '—'}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                      <td><Link href={`/requests/${r.id}`} className="text-xs hover:underline" style={{ color: 'var(--gold)' }}>View</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden divide-y" style={{ borderColor: 'rgba(245,166,35,0.08)' }}>
              {recent.map(r => (
                <Link key={r.id} href={`/requests/${r.id}`} className="flex items-center gap-3 p-4" style={{ textDecoration: 'none' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="badge badge-gold text-xs">{r.department}</span>
                    </div>
                    <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{r.purpose}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <StatusBadge status={r.status} />
                    {r.amount && <div className="text-xs mt-1 font-semibold" style={{ color: 'var(--gold)' }}>₹{Number(r.amount).toLocaleString('en-IN')}</div>}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}