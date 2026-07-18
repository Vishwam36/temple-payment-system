'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import { apiFetch } from '@/lib/apiClient'
import { CheckCircle, XCircle, ShieldCheck, PauseCircle, CheckCheck } from 'lucide-react'
import {
  ACTION, ACTION_LABELS, STATUS_ACTIONS, STAGE_OWNER_ROLES,
  SENDER_ACCOUNT_ACTIONS, STATUS, ROLES_DB, HOLD_REASON_MIN_LENGTH, REJECTION_REASON_MIN_LENGTH,
  ACCOUNT_NO_REGEX, IFSC_CODE_REGEX
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
  senderAccount = null, // Inherited { account_no, ifsc_code, account_holder } from DB if previously configured
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
  const [customAccountNo, setCustomAccountNo] = useState('')
  const [customIfscCode, setCustomIfscCode] = useState('')
  const [customAccountHolder, setCustomAccountHolder] = useState('')

  // ── STATE-MACHINE VALIDATION LAYER ──────────────────────────
  const ownerRoles = STAGE_OWNER_ROLES[currentStatus] || []
  const canAct = userRole === ROLES_DB.super_admin || ownerRoles.includes(userRole)
  const availableActions = canAct ? (STATUS_ACTIONS[currentStatus] || []) : []

  if (availableActions.length === 0) return null

  const hasExistingSender = !!senderAccount?.account_no

  function openAction(action) {
    setError('')
    setHoldReason('')
    setRejectReason('')
    setSelectedPreset('custom')
    setCustomAccountNo('')
    setCustomIfscCode('')
    setCustomAccountHolder('')
    setActiveAction(action)
  }

  function closeModal() {
    setActiveAction(null)
    setError('')
  }

  function getFinalSenderAccount() {
    if (selectedPreset === 'custom') {
      return {
        account_no: customAccountNo.trim(),
        ifsc_code: customIfscCode.trim().toUpperCase(),
        account_holder: customAccountHolder.trim(),
      }
    }
    const preset = accountPresets.find(p => String(p.id) === selectedPreset)
    return preset
      ? { account_no: preset.account_no, ifsc_code: preset.ifsc_code, account_holder: preset.account_holder }
      : { account_no: '', ifsc_code: '', account_holder: '' }
  }

  async function submit(action, target) {
    setError('')

    const payload = { status: target }

    if (SENDER_ACCOUNT_ACTIONS.includes(action) && !hasExistingSender) {
      const finalAccount = getFinalSenderAccount()
      const isComplete = !!(finalAccount.account_no && finalAccount.ifsc_code && finalAccount.account_holder)
      // Rule enforcement: Block PA approvals if no source is mapped anywhere
      const isAccountCompulsory = action === ACTION.APPROVE && currentStatus === STATUS.PENDING_PA
      if (isAccountCompulsory && !isComplete) {
        setError('A Sender Account is mandatory. The Department COM omitted it, so it must be specified now to clear this request.')
        return
      }
      if (isComplete) {
        if (!ACCOUNT_NO_REGEX.test(finalAccount.account_no)) {
          setError('Sender account number must be numeric (6-20 digits).')
          return
        }
        if (!IFSC_CODE_REGEX.test(finalAccount.ifsc_code)) {
          setError('Sender IFSC code format is invalid (e.g. SBIN0001234).')
          return
        }
        payload.sender_account_no = finalAccount.account_no
        payload.sender_ifsc_code = finalAccount.ifsc_code
        payload.sender_account_holder = finalAccount.account_holder
      }
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
                className="p-3 rounded-lg text-xs font-mono border space-y-1"
                style={{ background: '#FFFFFF', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                <div>A/C No: {senderAccount.account_no}</div>
                <div>IFSC: {senderAccount.ifsc_code}</div>
                <div>Holder: {senderAccount.account_holder}</div>
              </div>
            ) : (
              /* Active Configuration State: Render interactive custom selections */
              <div className="space-y-3">
                <select
                  id='sender-account-select'
                  value={selectedPreset}
                  onChange={(e) => {
                    setSelectedPreset(e.target.value)
                    if (e.target.value !== 'custom') {
                      setCustomAccountNo('')
                      setCustomIfscCode('')
                      setCustomAccountHolder('')
                    }
                  }}
                  className="w-full rounded-lg p-2.5 text-sm"
                  style={{ background: '#FFFFFF', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  <option value="custom">✍️ Custom Account / Manual Entry</option>
                  {accountPresets.map((preset) => (
                    <option key={preset.id} value={String(preset.id)}>
                      📁 {preset.label} — A/C {preset.account_no} · IFSC {preset.ifsc_code} · {preset.account_holder}
                    </option>
                  ))}
                </select>

                <div className="space-y-2">
                  <input
                    id='sender-account-no-input'
                    type="text"
                    inputMode="numeric"
                    className="w-full rounded-lg p-2.5 text-xs font-mono transition-all"
                    placeholder="Account Number"
                    value={selectedPreset === 'custom' ? customAccountNo : (accountPresets.find(p => String(p.id) === selectedPreset)?.account_no || '')}
                    onChange={(e) => setCustomAccountNo(e.target.value.replace(/[^0-9]/g, ''))}
                    disabled={selectedPreset !== 'custom'}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid var(--border)',
                      color: selectedPreset !== 'custom' ? 'var(--text-muted)' : 'var(--text-primary)',
                      opacity: selectedPreset !== 'custom' ? 0.6 : 1,
                    }}
                  />
                  <input
                    id='sender-ifsc-input'
                    type="text"
                    className="w-full rounded-lg p-2.5 text-xs font-mono transition-all"
                    placeholder="IFSC Code"
                    value={selectedPreset === 'custom' ? customIfscCode : (accountPresets.find(p => String(p.id) === selectedPreset)?.ifsc_code || '')}
                    onChange={(e) => setCustomIfscCode(e.target.value.toUpperCase())}
                    disabled={selectedPreset !== 'custom'}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid var(--border)',
                      color: selectedPreset !== 'custom' ? 'var(--text-muted)' : 'var(--text-primary)',
                      opacity: selectedPreset !== 'custom' ? 0.6 : 1,
                      textTransform: 'uppercase'
                    }}
                  />
                  <input
                    id='sender-account-holder-input'
                    type="text"
                    className="w-full rounded-lg p-2.5 text-xs font-mono transition-all"
                    placeholder="Account Holder Name"
                    value={selectedPreset === 'custom' ? customAccountHolder : (accountPresets.find(p => String(p.id) === selectedPreset)?.account_holder || '')}
                    onChange={(e) => setCustomAccountHolder(e.target.value)}
                    disabled={selectedPreset !== 'custom'}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid var(--border)',
                      color: selectedPreset !== 'custom' ? 'var(--text-muted)' : 'var(--text-primary)',
                      opacity: selectedPreset !== 'custom' ? 0.6 : 1,
                    }}
                  />
                </div>
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
