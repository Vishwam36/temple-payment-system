// app/requests/[id]/page.js

import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { StatusBadge } from '@/components/ui/StatusBadge'
import ApprovalActions from '@/components/requests/ApprovalActions'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { getComDepartments, isUserGlobalScoper, getUserRolesAndScopes, getMatchingRoleRow } from '@/lib/utils'
import { STATUS, TERMINAL_STATUSES, ROLES_DB } from '@/lib/constants'

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
  const roleRows = await getUserRolesAndScopes(user.id)

  const isGlobalScoper = isUserGlobalScoper(roleRows)
  const comDepartments = getComDepartments(roleRows)

  // 4. Strict Visibility Guardrail Check
  const isOwner = req.applicant_id === user.id
  const isDeptComForThisReq = comDepartments.includes(req.department)

  if (!isGlobalScoper && !isOwner && !isDeptComForThisReq) {
    notFound() // Safely obscure record existence from unprivileged profiles
  }

  // 5. Contextual Role Extraction
  const matchingRoleRow = getMatchingRoleRow(roleRows, req.department)

  // 6. Fetch Shared Sender Account Presets for Approval Workflows
  const { data: accountPresets = [] } = await admin
    .from('frequently_used_accounts')
    .select('*')
    .in('account_type', ['sender', 'both'])

  const isTerminal = TERMINAL_STATUSES.includes(req.status)
  const isOnHold = req.status === STATUS.ON_HOLD
  const isSuccessful = req.status === STATUS.SUCCESSFUL

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/requests" className="btn-secondary px-3 py-2" style={{ minHeight: 36 }}><ArrowLeft size={16} /></Link>
        <div>
          <h1 className="text-xl font-bold gradient-text">Request Detail</h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{req.id}</p>
        </div>
      </div>

      {/* On-hold warning banner — always shown at the top while status is on_hold */}
      {isOnHold && (
        <div className="alert-banner alert-warning mb-4">
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="font-bold text-sm mb-1">This request is on hold</div>
            <div className="text-sm">{req.hold_reason}</div>
          </div>
        </div>
      )}

      {/* Details card */}
      <div className="glass-card rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <span className="badge badge-gold text-sm">{req.department}</span>
          </div>
          <StatusBadge status={req.status} />
        </div>

        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{req.purpose}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
          <div>
            <div className="form-label mb-1">Submitted by</div>
            <div style={{ color: 'var(--text-primary)' }}>{req.applicant?.full_name || req.applicant?.email}</div>
          </div>
          <div>
            <div className="form-label mb-1">Date</div>
            <div style={{ color: 'var(--text-primary)' }}>{new Date(req.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
          </div>
          {req.amount && (
            <div className="md:col-span-2">
              <div className="form-label mb-1">Amount</div>
              <div className="font-bold text-lg" style={{ color: 'var(--gold)' }}>₹{Number(req.amount).toLocaleString('en-IN')}</div>
            </div>
          )}

          {/* Destination Account: Set by Applicant */}
          <div className="md:col-span-2">
            <div className="form-label mb-1">Receiver Account / Destination</div>
            <div
              className="p-3 rounded-lg text-xs font-mono break-all border"
              style={{
                background: 'var(--bg-surface)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap'
              }}
            >
              {req.receiver_account || 'Not Specified'}
            </div>
          </div>

          {/* Source Account: Dynamic visualization based on progression state */}
          {req.sender_account && (
            <div className="md:col-span-2">
              <div className="form-label mb-1">Sender Account (Debited Source)</div>
              <div
                className="p-3 rounded-lg text-xs font-mono break-all border"
                style={{
                  background: 'var(--gold-light)',
                  borderColor: 'var(--gold)',
                  color: '#B45309',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {req.sender_account}
              </div>
            </div>
          )}
        </div>

        {/* Approval actions panel */}
        {!isTerminal && (
          <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <div className="form-label mb-3">Actions</div>
            <ApprovalActions
              requestId={req.id}
              currentStatus={req.status}
              userRole={matchingRoleRow?.role || ROLES_DB.applicant}
              senderAccount={req.sender_account}
              accountPresets={accountPresets}
            />
          </div>
        )}
        {isTerminal && (
          <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <div className={`alert ${isSuccessful ? 'alert-success' : 'alert-error'}`}>
              {isSuccessful ? '✅ This request has been disbursed successfully.' : '❌ This request has been rejected and is final.'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
