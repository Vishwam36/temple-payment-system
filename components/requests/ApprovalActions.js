'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import { apiFetch } from '@/lib/apiClient'
import { CheckCircle, XCircle, ShieldCheck, PauseCircle, CheckCheck } from 'lucide-react'
import {
  ACTION, ACTION_LABELS, STATUS_ACTIONS, STAGE_OWNER_ROLES,
  SENDER_ACCOUNT_ACTIONS, STATUS, ROLES_DB, HOLD_REASON_MIN_LENGTH, REJECTION_REASON_MIN_LENGTH
} from '@/lib/constants'

const ACTION_ICONS = {
  [ACTION.APPROVE]: CheckCircle,
  [ACTION.VERIFY]: ShieldCheck,
  [ACTION.HOLD]: PauseCircle,
  [ACTION.MARK_SUCCESSFUL]: CheckCheck,
  [ACTION.REJECT]: XCircle,
}

const ACTION_BUTTON_CLASS = {
  [ACTION.APPROVE]: 'btn-primary',
  [ACTION.VERIFY]: 'btn-primary',
  [ACTION.HOLD]: 'btn-secondary',
  [ACTION.MARK_SUCCESSFUL]: 'btn-primary',
  [ACTION.REJECT]: 'btn-danger',
}

export default function ApprovalActions({
  requestId,
  currentStatus,
  userRole,
  senderAccount = '', // Inherited source account from DB if previously configured
  accountPresets = []  // Shared frequently used accounts ledger passed from parent page
}) {
  const router = useRouter()
  const [activeAction, setActiveAction] = useState(null)
  const [holdReason, setHoldReason] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── SENDER ACCOUNT MODAL SELECTION STATE ────────────────────
  const [selectedPreset, setSelectedPreset] = useState('custom')
  const [customAccount, setCustomAccount] = useState('')

  // ── STATE-MACHINE VALIDATION LAYER ──────────────────────────
  const ownerRoles = STAGE_OWNER_ROLES[currentStatus] || []
  const canAct = userRole === ROLES_DB.super_admin || ownerRoles.includes(userRole)
  const availableActions = canAct ? (STATUS_ACTIONS[currentStatus] || []) : []

  if (availableActions.length === 0) return null

  const hasExistingSender = !!senderAccount

  function openAction(action) {
    setError('')
    setHoldReason('')
    setRejectReason('')
    setSelectedPreset('custom')
    setCustomAccount('')
    setActiveAction(action)
  }

  function closeModal() {
    setActiveAction(null)
    setError('')
  }

  function getFinalSenderAccount() {
    if (hasExistingSender) return senderAccount
    return selectedPreset === 'custom' ? customAccount.trim() : selectedPreset
  }

  async function submit(action, target) {
    setError('')

    const payload = { status: target }

    if (SENDER_ACCOUNT_ACTIONS.includes(action)) {
      const finalAccount = getFinalSenderAccount()
      // Rule enforcement: Block PA approvals if no source is mapped anywhere
      const isAccountCompulsory = action === ACTION.APPROVE && currentStatus === STATUS.PENDING_PA && !hasExistingSender
      if (isAccountCompulsory && !finalAccount) {
        setError('A Sender Account is mandatory. The Department COM omitted it, so it must be specified now to clear this request.')
        return
      }
      payload.sender_account = hasExistingSender ? undefined : (finalAccount || null)
    }

    if (action === ACTION.HOLD) {
      if (holdReason.trim().length < HOLD_REASON_MIN_LENGTH) {
        setError('A hold reason is required.')
        return
      }
      payload.hold_reason = holdReason.trim()
    }

    if (action === ACTION.REJECT) {
      if (rejectReason.trim().length < REJECTION_REASON_MIN_LENGTH) {
        setError('A rejection reason is required.')
        return
      }
      payload.rejection_reason = rejectReason.trim()
    }

    setLoading(true)
    try {
      const res = await apiFetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to update the request.')
        setLoading(false)
      } else {
        setActiveAction(null)
        setLoading(false)
        router.refresh()
      }
    } catch (err) {
      setError('A network exception occurred while updating the request.')
      setLoading(false)
    }
  }

  return (
    <>
      {/* ── CORE ACTION TRIGGERS ───────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        {availableActions.map(({ action }) => {
          const Icon = ACTION_ICONS[action]
          return (
            <button
              key={action}
              id={`${action}-trigger-btn`}
              onClick={() => openAction(action)}
              disabled={loading}
              className={ACTION_BUTTON_CLASS[action]}
            >
              <Icon size={16} /> {ACTION_LABELS[action]}
            </button>
          )
        })}
      </div>

      {/* ── SENDER-ACCOUNT COLLECTING MODAL (Approve / Verify) ──── */}
      {availableActions.filter(a => SENDER_ACCOUNT_ACTIONS.includes(a.action)).map(({ action, target }) => (
        <Modal key={action} open={activeAction === action} onClose={closeModal} title={`Confirm ${ACTION_LABELS[action]}`}>
          <div className="mb-5 p-4 rounded-xl space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <label className="form-label block text-xs font-semibold">
              Source Debit Account {action === ACTION.APPROVE && currentStatus === STATUS.PENDING_PA && !hasExistingSender ? <span style={{ color: '#991B1B' }}>(Compulsory)</span> : ''}
            </label>

            {hasExistingSender ? (
              /* Read-Only State: Block changes once a sender account is already locked in */
              <div
                className="p-3 rounded-lg text-xs font-mono border"
                style={{ whiteSpace: 'pre-wrap', background: '#FFFFFF', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
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
                  style={{ background: '#FFFFFF', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
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
                    background: '#FFFFFF',
                    border: '1px solid var(--border)',
                    color: selectedPreset !== 'custom' ? 'var(--text-muted)' : 'var(--text-primary)',
                    opacity: selectedPreset !== 'custom' ? 0.6 : 1,
                    resize: 'none'
                  }}
                />
              </div>
            )}
          </div>

          {error && <div className="alert alert-error mb-4">{error}</div>}

          <div className="flex gap-3 mt-6">
            <button onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
            <button id={`confirm-${action}-btn`} onClick={() => submit(action, target)} disabled={loading} className="btn-primary flex-1">
              {loading ? 'Processing…' : `Confirm & ${ACTION_LABELS[action]}`}
            </button>
          </div>
        </Modal>
      ))}

      {/* ── HOLD MODAL (Required Reason) ────────────────────────── */}
      {availableActions.filter(a => a.action === ACTION.HOLD).map(({ action, target }) => (
        <Modal key="hold" open={activeAction === action} onClose={closeModal} title="Place Request On Hold">
          <div className="mb-4">
            <label className="form-label">Hold Reason *</label>
            <textarea
              id="hold-reason"
              className="form-input"
              rows={3}
              placeholder="Provide a clear reason for placing this request on hold."
              value={holdReason}
              onChange={e => setHoldReason(e.target.value)}
              style={{ resize: 'vertical', minHeight: 80 }}
            />
          </div>

          {error && <div className="alert alert-error mb-4">{error}</div>}

          <div className="flex gap-3">
            <button onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
            <button
              id="confirm-hold-btn"
              onClick={() => submit(action, target)}
              disabled={loading}
              className="btn-secondary flex-1"
            >
              {loading ? 'Processing…' : 'Confirm Hold'}
            </button>
          </div>
        </Modal>
      ))}

      {/* ── REJECT MODAL (Required Reason) ──────────────────────── */}
      {availableActions.filter(a => a.action === ACTION.REJECT).map(({ action, target }) => (
        <Modal key="reject" open={activeAction === action} onClose={closeModal} title="Reject Request">
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Rejection is permanent and cannot be undone.
          </p>
          <div className="mb-4">
            <label className="form-label">Rejection Reason *</label>
            <textarea
              id="reject-reason"
              className="form-input"
              rows={3}
              placeholder="Explain why this request is being rejected."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              style={{ resize: 'vertical', minHeight: 80 }}
            />
          </div>

          {error && <div className="alert alert-error mb-4">{error}</div>}

          <div className="flex gap-3">
            <button onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
            <button
              id="confirm-reject-btn"
              onClick={() => submit(action, target)}
              disabled={loading}
              className="btn-danger flex-1"
            >
              {loading ? 'Processing…' : 'Confirm Reject'}
            </button>
          </div>
        </Modal>
      ))}

      {/* ── SIMPLE CONFIRMATION MODAL (Mark Successful) ─────────── */}
      {availableActions.filter(a => a.action === ACTION.MARK_SUCCESSFUL).map(({ action, target }) => (
        <Modal key={action} open={activeAction === action} onClose={closeModal} title={`${ACTION_LABELS[action]} Request`}>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            This marks the disbursement as complete. This action is final.
          </p>

          {error && <div className="alert alert-error mb-4">{error}</div>}

          <div className="flex gap-3">
            <button onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
            <button
              id={`confirm-${action}-btn`}
              onClick={() => submit(action, target)}
              disabled={loading}
              className={`${ACTION_BUTTON_CLASS[action]} flex-1`}
            >
              {loading ? 'Processing…' : `${ACTION_LABELS[action]}`}
            </button>
          </div>
        </Modal>
      ))}
    </>
  )
}
