'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import { CheckCircle, XCircle } from 'lucide-react'

export default function ApprovalActions({ requestId, currentStatus, userRole }) {
  const router = useRouter()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Which statuses can this role act on?
  const canAct = {
    department_com:    currentStatus === 'pending_com',
    passing_authority: currentStatus === 'pending_pa',
    accounts_head:     currentStatus === 'pending_ah',
    super_admin:       ['pending_com','pending_pa','pending_ah'].includes(currentStatus),
  }[userRole]

  if (!canAct) return null

  async function approve() {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/requests/${requestId}/approve`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); setLoading(false) }
    else { router.refresh() }
  }

  async function reject() {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/requests/${requestId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed'); setLoading(false) }
    else { setRejectOpen(false); router.refresh() }
  }

  return (
    <>
      {error && <div className="rounded-lg p-3 text-sm mb-3" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#FCA5A5'}}>{error}</div>}

      <div className="flex flex-wrap gap-3">
        <button id="approve-btn" onClick={approve} disabled={loading} className="btn-primary">
          <CheckCircle size={16} /> Approve
        </button>
        <button id="reject-btn" onClick={() => setRejectOpen(true)} disabled={loading} className="btn-danger">
          <XCircle size={16} /> Reject
        </button>
      </div>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject Request">
        <p className="text-sm mb-4" style={{color:'var(--text-muted)'}}>
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
            style={{resize:'vertical',minHeight:80}}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={() => setRejectOpen(false)} className="btn-secondary flex-1">Cancel</button>
          <button id="confirm-reject-btn" onClick={reject} disabled={loading} className="btn-danger flex-1">
            {loading ? <><span className="spinner" style={{width:16,height:16}} /> Rejecting…</> : 'Confirm Reject'}
          </button>
        </div>
      </Modal>
    </>
  )
}
