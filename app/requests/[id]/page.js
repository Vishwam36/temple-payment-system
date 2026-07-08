// app/requests/[id]/page.js

import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { StatusBadge, ActionBadge } from '@/components/ui/StatusBadge'
import ApprovalActions from '@/components/requests/ApprovalActions'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'Request Detail — Temple Payment System' }

export default async function RequestDetailPage({ params }) {
  // 1. Unwrap the asynchronous params object safely
  const resolvedParams = await params
  const requestId = resolvedParams.id

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminServerClient()

  // 2. Fetch the target payment request detail record
  const { data: req, error: reqErr } = await admin
    .from('payment_requests')
    .select(`*, applicant:profiles!applicant_id(full_name, email)`)
    .eq('id', requestId)
    .single()

  if (reqErr || !req) notFound()

  // 3. Fetch all assigned roles and scoped boundaries for this client profile
  const { data: roleRows } = await admin
    .from('user_roles')
    .select('role, department')
    .eq('profile_id', user.id)

  const roles = roleRows?.map(r => r.role) || []
  const isGlobalScoper = roles.some(r => ['super_admin', 'accounts_head', 'passing_authority'].includes(r))
  const comDepartments = roleRows?.filter(r => r.role === 'department_com' && r.department).map(r => r.department) || []

  // 4. Strict Visibility Guardrail Check
  const isOwner = req.applicant_id === user.id
  const isDeptComForThisReq = comDepartments.includes(req.department)

  if (!isGlobalScoper && !isOwner && !isDeptComForThisReq) {
    notFound() // Safely obscure record existence from unprivileged profiles
  }

  // 5. Contextual Role Extraction
  // Determines which precise role this user is operating under for this specific department workflow stage
  const matchingRoleRow = roleRows?.find(r => {
    if (['super_admin', 'accounts_head', 'passing_authority'].includes(r.role)) return true
    if (r.role === 'department_com' && r.department === req.department) return true
    return false
  })

  // Fetch immutable timeline ledger trail records
  const { data: history = [] } = await admin
    .from('request_history')
    .select(`*, actor:profiles!actor_id(full_name, email)`)
    .eq('request_id', requestId)
    .order('created_at', { ascending: true })

  const isTerminal = ['approved', 'rejected'].includes(req.status)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/requests" className="btn-secondary px-3 py-2" style={{ minHeight: 36 }}><ArrowLeft size={16} /></Link>
        <div>
          <h1 className="text-xl font-bold gradient-text">Request Detail</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{req.id}</p>
        </div>
      </div>

      {/* Details card */}
      <div className="glass-card rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <span className="badge badge-gold text-sm">{req.department}</span>
          </div>
          <StatusBadge status={req.status} />
        </div>

        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{req.purpose}</h2>

        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <div className="form-label mb-1">Submitted by</div>
            <div style={{ color: 'var(--text-primary)' }}>{req.applicant?.full_name || req.applicant?.email}</div>
          </div>
          <div>
            <div className="form-label mb-1">Date</div>
            <div style={{ color: 'var(--text-primary)' }}>{new Date(req.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
          </div>
          {req.amount && (
            <div>
              <div className="form-label mb-1">Amount</div>
              <div className="font-bold text-lg" style={{ color: 'var(--gold)' }}>₹{Number(req.amount).toLocaleString('en-IN')}</div>
            </div>
          )}
          {req.sender_account && (
            <div>
              <div className="form-label mb-1">Sender Account</div>
              <div style={{ color: 'var(--text-primary)' }}>{req.sender_account}</div>
            </div>
          )}
        </div>

        {/* Approval actions panel */}
        {!isTerminal && (
          <div className="border-t pt-4" style={{ borderColor: 'rgba(245,166,35,0.1)' }}>
            <div className="form-label mb-3">Actions</div>
            <ApprovalActions
              requestId={req.id}
              currentStatus={req.status}
              userRole={matchingRoleRow?.role || 'applicant'}
            />
          </div>
        )}
        {isTerminal && (
          <div className="border-t pt-4" style={{ borderColor: 'rgba(245,166,35,0.1)' }}>
            <div className="rounded-lg p-3 text-sm"
              style={{
                background: req.status === 'approved' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${req.status === 'approved' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: req.status === 'approved' ? '#6EE7B7' : '#FCA5A5',
              }}>
              {req.status === 'approved' ? '✅ This request has been fully approved.' : '❌ This request has been rejected and is final.'}
            </div>
          </div>
        )}
      </div>

      {/* Timeline view block */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="font-bold text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>APPROVAL TIMELINE</h3>
        <div>
          {history.map((h, i) => (
            <div key={h.id} className="timeline-item">
              <div className="timeline-dot" style={{
                borderColor: h.action.includes('rejected') ? '#EF4444' : h.action.includes('approved') ? '#10B981' : 'var(--gold)',
                background: h.action.includes('rejected') ? 'rgba(239,68,68,0.2)' : h.action.includes('approved') ? 'rgba(16,185,129,0.2)' : 'rgba(245,166,35,0.2)',
              }} />
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <ActionBadge action={h.action} />
                </div>
                <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  <strong>{h.actor?.full_name || h.actor?.email}</strong>
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {new Date(h.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
                {h.reason && (
                  <div className="mt-2 text-xs rounded-lg p-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5' }}>
                    Reason: {h.reason}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}