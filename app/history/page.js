// app/history/page.js

import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ActionBadge, StatusBadge } from '@/components/ui/StatusBadge'
import Link from 'next/link'
import { isUserGlobalScoper, getComDepartments, getUserRolesAndScopes } from '@/lib/utils'

export default async function HistoryPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminServerClient()

  // 1. Resolve role boundaries from the many-to-many relationship mapping table
  const roleRows = await getUserRolesAndScopes(user.id)

  const isGlobalScoper = isUserGlobalScoper(roleRows)
  const comDepartments = getComDepartments(roleRows)

  // 2. Base Query utilizing an explicit inner join boundary
  let query = admin
    .from('request_history')
    .select(`
      id, action, reason, created_at,
      payment_requests!inner (
        id, purpose, department, amount, status, applicant_id,
        applicant:profiles!applicant_id ( full_name, email )
      ),
      actor:profiles!actor_id ( full_name, email )
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  // ── MATRIX VISIBILITY RULES ─────────────────────────────────
  if (!isGlobalScoper) {
    if (comDepartments.length > 0) {
      // User sees history entries they personally applied for OR entries matching departments they manage
      query = query.or(
        `applicant_id.eq.${user.id},department.in.(${comDepartments.join(',')})`,
        { foreignTable: 'payment_requests' }
      )
    } else {
      // Standard applicant fallback container boundary
      query = query.eq('payment_requests.applicant_id', user.id)
    }
  }
  // Global roles skip filtering blocks entirely and view all activity logs

  const { data: history = [] } = await query

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold gradient-text">Audit History</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {isGlobalScoper
            ? 'All system activity — immutable log'
            : comDepartments.length > 0
              ? 'Activity for your managed departments & personal requests'
              : 'Your request activity'}
        </p>
      </div>

      {history === null || history?.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p style={{ color: 'var(--text-muted)' }}>No history records yet</p>
        </div>
      ) : (
        <>
          {/* Desktop view table layout */}
          <div className="hidden md:block glass-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Department</th>
                    <th>Purpose</th>
                    <th>Amount</th>
                    <th>Actor</th>
                    <th>Status</th>
                    <th>When</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => (
                    <tr key={h.id}>
                      <td><ActionBadge action={h.action} /></td>
                      <td><span className="badge badge-gold">{h.payment_requests?.department}</span></td>
                      <td className="max-w-xs">
                        <span className="text-sm line-clamp-1">{h.payment_requests?.purpose}</span>
                        {h.reason && <div className="text-xs mt-0.5" style={{ color: '#FCA5A5' }}>↳ {h.reason}</div>}
                      </td>
                      <td>
                        {h.payment_requests?.amount
                          ? <span style={{ color: 'var(--gold)', fontWeight: 600 }}>₹{Number(h.payment_requests.amount).toLocaleString('en-IN')}</span>
                          : '—'}
                      </td>
                      <td className="text-sm">{h.actor?.full_name || h.actor?.email || '—'}</td>
                      <td><StatusBadge status={h.payment_requests?.status} /></td>
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(h.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td>
                        <Link href={`/requests/${h.payment_requests?.id}`} className="text-xs hover:underline" style={{ color: 'var(--gold)' }}>View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile view responsive cards layout */}
          <div className="md:hidden space-y-3">
            {history.map(h => (
              <Link key={h.id} href={`/requests/${h.payment_requests?.id}`} className="block glass-card rounded-xl p-4" style={{ textDecoration: 'none' }}>
                <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                  <ActionBadge action={h.action} />
                  <span className="badge badge-gold">{h.payment_requests?.department}</span>
                </div>
                <p className="text-sm line-clamp-2 mb-2" style={{ color: 'var(--text-primary)' }}>{h.payment_requests?.purpose}</p>
                {h.reason && <p className="text-xs mb-2" style={{ color: '#FCA5A5' }}>Reason: {h.reason}</p>}
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>By {h.actor?.full_name || h.actor?.email}</span>
                  <span>{new Date(h.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}