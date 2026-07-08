'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import { CheckCircle, XCircle } from 'lucide-react'

export default function ApprovalActions({
  requestId,
  currentStatus,
  userRole,
  senderAccount = '', // Inherited source account from DB if previously configured
  accountPresets = []  // Shared frequently used accounts ledger passed from parent page
}) {
  const router = useRouter()
  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── SENDER ACCOUNT MODAL SELECTION STATE ────────────────────
  const [selectedPreset, setSelectedPreset] = useState('custom')
  const [customAccount, setCustomAccount] = useState('')

  // ── STATE-MACHINE VALIDATION LAYER ──────────────────────────
  const canAct = {
    department_com: currentStatus === 'pending_com',
    passing_authority: currentStatus === 'pending_pa',
    accounts_head: currentStatus === 'pending_ah',
    super_admin: ['pending_com', 'pending_pa', 'pending_ah'].includes(currentStatus),
  }[userRole]

  if (!canAct) return null

  const isComPhase = currentStatus === 'pending_com'
  const isPaPhase = currentStatus === 'pending_pa'

  // Sender accounts are collected during either the COM review phase or Passing Authority verification
  const collectSenderAccount = isComPhase || isPaPhase
  const hasExistingSender = !!senderAccount
  const isAccountCompulsory = isPaPhase && !hasExistingSender

  const getFinalSenderAccount = () => {
    if (hasExistingSender) return senderAccount
    return selectedPreset === 'custom' ? customAccount.trim() : selectedPreset
  }

  async function approve() {
    setError('')
    const finalAccount = getFinalSenderAccount()

    // Rule enforcement: Block PA approvals if no source is mapped anywhere
    if (isAccountCompulsory && !finalAccount) {
      setError('A Sender Account is mandatory. The Department COM omitted it, so it must be specified now to clear this request.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_account: hasExistingSender ? undefined : finalAccount || null
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to authorize request approval.')
        setLoading(false)
      } else {
        setApproveOpen(false)
        router.refresh()
      }
    } catch (err) {
      setError('A network exception occurred while updating transaction records.')
      setLoading(false)
    }
  }

  async function reject() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to process rejection pathway.')
        setLoading(false)
      } else {
        setRejectOpen(false)
        router.refresh()
      }
    } catch (err) {
      setError('A network exception occurred while executing rejection process.')
      setLoading(false)
    }
  }

  return (
    <>
      {error && (
        <div className="rounded-lg p-3 text-sm mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
          {error}
        </div>
      )}

      {/* ── CORE ACTION TRIGGERS ───────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <button id="approve-trigger-btn" onClick={() => setApproveOpen(true)} disabled={loading} className="btn-primary">
          <CheckCircle size={16} /> Approve
        </button>
        <button id="reject-trigger-btn" onClick={() => setRejectOpen(true)} disabled={loading} className="btn-danger">
          <XCircle size={16} /> Reject
        </button>
      </div>

      {/* ── INTERACTIVE APPROVAL MODAL (SENDER ACCOUNT POPUP) ──── */}
      <Modal open={approveOpen} onClose={() => setApproveOpen(false)} title="Confirm Request Approval">
        {collectSenderAccount && (
          <div className="mb-5 p-4 rounded-xl space-y-3 bg-black/20 border border-white/5">
            <label className="form-label block text-xs font-semibold">
              Source Debit Account {isAccountCompulsory ? <span style={{ color: '#EF4444' }}>(Compulsory)</span> : '(Optional for COM)'}
            </label>

            {hasExistingSender ? (
              /* Read-Only State: Block changes if COM locked an entry */
              <div
                className="p-3 rounded-lg text-xs font-mono bg-emerald-500/5 border border-emerald-500/20 text-emerald-400"
                style={{ whiteSpace: 'pre-wrap', backgroundColor: '#FFF' }}
              >
                <span className="text-stone-400 block mb-1">Locked by Department COM:</span>
                {senderAccount}
              </div>
            ) : (
              /* Active Configuration State: Render interactive custom selections */
              <div className="space-y-3">
                <select
                  id='sender-account-select'
                  value={selectedPreset}
                  onChange={(e) => {
                    setSelectedPreset(e.target.value)
                    if (e.target.value !== 'custom') setCustomAccount('')
                  }}
                  className="w-full rounded-lg p-2.5 text-sm"
                  style={{ background: 'var(--bg-dark)', border: '1px solid rgba(245,166,35,0.2)', color: 'var(--text-primary)' }}
                >
                  <option value="custom">✍️ Custom Account / Manual Text Field Input</option>
                  {accountPresets.map((preset) => (
                    <option key={preset.id} value={preset.account_string}>
                      📁 {preset.label}
                    </option>
                  ))}
                </select>

                <textarea
                  id='sender-account-textbox'
                  className="w-full rounded-lg p-2.5 text-xs font-mono transition-all"
                  rows={3}
                  placeholder="Enter custom account profile fields manually (Bank Name, A/C No, IFSC Code, or UPI ID address payload)..."
                  value={selectedPreset === 'custom' ? customAccount : selectedPreset}
                  onChange={(e) => setCustomAccount(e.target.value)}
                  disabled={selectedPreset !== 'custom'}
                  style={{
                    background: 'rgba(255, 255, 255, 1)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: selectedPreset !== 'custom' ? 'var(--gold)' : 'var(--text-primary)',
                    opacity: selectedPreset !== 'custom' ? 0.5 : 1,
                    resize: 'none'
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={() => setApproveOpen(false)} className="btn-secondary flex-1">Cancel</button>
          <button id="confirm-approve-btn" onClick={approve} disabled={loading} className="btn-primary flex-1">
            {loading ? 'Processing…' : 'Confirm & Approve'}
          </button>
        </div>
      </Modal>

      {/* ── TERMINAL REJECTION ROUTINE MODAL ───────────────────── */}
      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject Request">
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Rejection is permanent and cannot be undone. Optionally provide a reason.
        </p>
        <div className="mb-4">
          <label className="form-label">Reason (optional)</label>
          <textarea
            id="reject-reason"
            className="form-input"
            rows={3}
            placeholder="Why is this request being rejected?"
            value={reason}
            onChange={e => setReason(e.target.value)}
            style={{ resize: 'vertical', minHeight: 80 }}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={() => setRejectOpen(false)} className="btn-secondary flex-1">Cancel</button>
          <button id="confirm-reject-btn" onClick={reject} disabled={loading} className="btn-danger flex-1">
            {loading ? 'Rejecting…' : 'Confirm Reject'}
          </button>
        </div>
      </Modal>
    </>
  )
}