'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import { apiFetch } from '@/lib/apiClient'
import { CheckCircle, XCircle, ShieldCheck, PauseCircle, CheckCheck, ClipboardCheck, AlertTriangle } from 'lucide-react'
import {
  ACTION, ACTION_LABELS, STATUS_ACTIONS, STAGE_OWNER_ROLES,
  SENDER_ACCOUNT_ACTIONS, STATUS, ROLES_DB, REJECTION_REASON_MIN_LENGTH,
  PREDEFINED_HOLD_REASONS, HOLD_REASON_OTHER
} from '@/lib/constants'
import { normalizeHoldReasons, buildHoldRemarks, validateHoldSubmission } from '@/lib/holdReasons'
import {
  SENDER_ACCOUNT_REQUIRED_MESSAGE, normalizeSenderAccount, isSenderAccountComplete, sameSenderAccount,
  getSenderAccountFormatError, isSenderAccountRequired, canEditSenderAccount
} from '@/lib/senderAccount'
import { useRequestActivity } from '@/components/requests/RequestActivity'

const ACTION_ICONS = {
  [ACTION.APPROVE]: CheckCircle,
  [ACTION.VERIFY]: ShieldCheck,
  [ACTION.HOLD]: PauseCircle,
  [ACTION.MARK_SUCCESSFUL]: CheckCheck,
  [ACTION.REJECT]: XCircle,
}

// Checkbox list of the predefined hold reasons — used by both the Verification
// Checklist and the Hold modal so the two always show the same items.
function ReasonCheckboxes({ idPrefix, selected, onToggle, disabled = false }) {
  return (
    <div className="space-y-1">
      {PREDEFINED_HOLD_REASONS.map((reason, i) => {
        const checked = selected.includes(reason)
        return (
          <label
            key={reason}
            htmlFor={`${idPrefix}-${i}`}
            className="flex items-start gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer"
            style={{
              background: checked ? '#FEF9C3' : 'transparent',
              border: `1px solid ${checked ? '#FDE047' : 'transparent'}`,
              color: 'var(--text-primary)',
            }}
          >
            <input
              id={`${idPrefix}-${i}`}
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => onToggle(reason)}
              className="mt-0.5 shrink-0"
              style={{ width: 16, height: 16, accentColor: 'var(--saffron)' }}
            />
            <span>{reason}</span>
          </label>
        )
      })}
    </div>
  )
}

const toggleIn = (list, item) => list.includes(item) ? list.filter(r => r !== item) : [...list, item]

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
  const [rejectReason, setRejectReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const submittingRef = useRef(false) // Blocks double-clicks before `loading` re-renders the button

  // ── VERIFICATION CHECKLIST (Supervisor review) ──────────────
  // Client-side draft only; selected reasons reach the DB only as Hold Remarks text.
  const [flagged, setFlagged] = useState([])
  const [savedFlagged, setSavedFlagged] = useState([]) // What the last confirmed hold recorded
  const [verifyWarning, setVerifyWarning] = useState(false)

  // ── HOLD MODAL DRAFT ────────────────────────────────────────
  // Seeded from the checklist on open; discarded on cancel. `holdGenerated` is the
  // last auto-built remarks text, so we can tell when the user has edited it.
  const [holdReasons, setHoldReasons] = useState([])
  const [holdOther, setHoldOther] = useState('')
  const [holdRemarks, setHoldRemarks] = useState('')
  const [holdGenerated, setHoldGenerated] = useState('')

  // ── SENDER ACCOUNT MODAL SELECTION STATE ────────────────────
  const [selectedPreset, setSelectedPreset] = useState('custom')
  const [customAccountNo, setCustomAccountNo] = useState('')
  const [customIfscCode, setCustomIfscCode] = useState('')
  const [customAccountHolder, setCustomAccountHolder] = useState('')

  // ── PAGE ACTIVITY (Next Task navigation guard) ──────────────
  // An open action dialog or checklist ticks not yet saved by a hold count as unsaved work.
  const activity = useRequestActivity()
  const { setDirty, setBusy } = activity || {}
  const dirty = activeAction !== null ||
    flagged.length !== savedFlagged.length || flagged.some(r => !savedFlagged.includes(r))
  useEffect(() => {
    setDirty?.(dirty)
    return () => setDirty?.(false)
  }, [dirty, setDirty])
  useEffect(() => {
    setBusy?.(loading)
    return () => setBusy?.(false)
  }, [loading, setBusy])

  // ── STATE-MACHINE VALIDATION LAYER ──────────────────────────
  const ownerRoles = STAGE_OWNER_ROLES[currentStatus] || []
  const canAct = userRole === ROLES_DB.super_admin || ownerRoles.includes(userRole)
  const availableActions = canAct ? (STATUS_ACTIONS[currentStatus] || []) : []

  if (availableActions.length === 0) return null

  const hasExistingSender = !!senderAccount?.account_no
  const showChecklist = availableActions.some(a => a.action === ACTION.VERIFY)
  const remarksEdited = holdRemarks !== holdGenerated

  function openAction(action) {
    // Never verify past flagged issues — ask the Supervisor to resolve/clear them first
    if (action === ACTION.VERIFY && showChecklist && flagged.length > 0) {
      setVerifyWarning(true)
      return
    }
    setVerifyWarning(false)
    if (action === ACTION.HOLD) {
      const initial = buildHoldRemarks(flagged, '')
      setHoldReasons(flagged)
      setHoldOther('')
      setHoldRemarks(initial)
      setHoldGenerated(initial)
    }
    setError('')
    setRejectReason('')
    // The Passing Authority starts from the account the Department COM chose (as its preset,
    // or pre-filled manual entry); everyone else starts blank — nothing is auto-selected.
    const prefill = hasExistingSender && canEditSenderAccount(currentStatus, action, hasExistingSender)
    const matchingPreset = prefill ? accountPresets.find(p => sameSenderAccount(p, senderAccount)) : null
    const prefillCustom = prefill && !matchingPreset
    setSelectedPreset(matchingPreset ? String(matchingPreset.id) : 'custom')
    setCustomAccountNo(prefillCustom ? senderAccount.account_no : '')
    setCustomIfscCode(prefillCustom ? senderAccount.ifsc_code : '')
    setCustomAccountHolder(prefillCustom ? senderAccount.account_holder : '')
    setActiveAction(action)
  }

  function closeModal() {
    setActiveAction(null)
    setError('')
  }

  function toggleFlagged(reason) {
    setFlagged(prev => normalizeHoldReasons(toggleIn(prev, reason)))
  }

  // Regenerates the remarks while they are untouched. Once edited, the user's text is
  // preserved: newly selected reasons are appended, nothing is removed or rewritten.
  function updateHoldDraft(nextReasons, nextOther) {
    const nextGenerated = buildHoldRemarks(nextReasons, nextOther)
    if (!remarksEdited) {
      setHoldRemarks(nextGenerated)
    } else {
      const added = normalizeHoldReasons(nextReasons)
        .filter(r => r !== HOLD_REASON_OTHER && !holdReasons.includes(r))
      if (added.length) setHoldRemarks([holdRemarks.trim(), ...added].filter(Boolean).join('\n\n'))
    }
    setHoldGenerated(nextGenerated)
    setHoldReasons(normalizeHoldReasons(nextReasons))
    setHoldOther(nextOther)
  }

  function resetHoldRemarks() {
    if (!confirm('Replace your edited remarks with the selected reasons?')) return
    setHoldRemarks(holdGenerated)
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
    if (submittingRef.current) return
    setError('')

    const payload = { status: target }

    if (SENDER_ACCOUNT_ACTIONS.includes(action) && canEditSenderAccount(currentStatus, action, hasExistingSender)) {
      const finalAccount = normalizeSenderAccount(getFinalSenderAccount())
      const isComplete = isSenderAccountComplete(finalAccount)
      // Department COM (and the PA on older requests without one) must choose an account to approve
      if (isSenderAccountRequired(currentStatus, action) && !isComplete) {
        setError(SENDER_ACCOUNT_REQUIRED_MESSAGE)
        return
      }
      if (isComplete) {
        const formatError = getSenderAccountFormatError(finalAccount)
        if (formatError) {
          setError(formatError)
          return
        }
        // A Passing Authority keeping the COM's account sends nothing — the stored one stays
        if (!sameSenderAccount(finalAccount, senderAccount)) {
          payload.sender_account_no = finalAccount.account_no
          payload.sender_ifsc_code = finalAccount.ifsc_code
          payload.sender_account_holder = finalAccount.account_holder
        }
      }
    }

    if (action === ACTION.HOLD) {
      const holdError = validateHoldSubmission({ reasons: holdReasons, otherText: holdOther, remarks: holdRemarks })
      if (holdError) {
        setError(holdError)
        return
      }
      payload.hold_reasons = holdReasons
      payload.hold_other_reason = holdReasons.includes(HOLD_REASON_OTHER) ? holdOther.trim() : ''
      payload.hold_reason = holdRemarks.trim()
    }

    if (action === ACTION.REJECT) {
      if (rejectReason.trim().length < REJECTION_REASON_MIN_LENGTH) {
        setError('A rejection reason is required.')
        return
      }
      payload.rejection_reason = rejectReason.trim()
    }

    submittingRef.current = true
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
      } else {
        // The hold is confirmed — the checklist now reflects what was actually saved
        if (action === ACTION.HOLD) {
          setFlagged(holdReasons)
          setSavedFlagged(holdReasons)
        }
        setActiveAction(null)
        activity?.setCompleted(action)
        router.refresh()
      }
    } catch (err) {
      setError('A network exception occurred while updating the request.')
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  return (
    <>
      {/* ── VERIFICATION CHECKLIST (Supervisor review stage) ───── */}
      {showChecklist && (
        <div className="mb-4 p-4 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              <ClipboardCheck size={16} style={{ color: 'var(--saffron)' }} /> Verification Checklist
            </div>
            {flagged.length > 0 && (
              <span className="badge badge-yellow">{flagged.length} flagged</span>
            )}
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
            Tick any issue found while reviewing. Verify only when nothing is flagged; otherwise place the request on hold.
          </p>
          <ReasonCheckboxes idPrefix="checklist-reason" selected={flagged} onToggle={toggleFlagged} disabled={loading} />
        </div>
      )}

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

      {verifyWarning && flagged.length > 0 && (
        <div className="alert alert-warning mt-4 flex items-start gap-2" role="alert">
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div className="text-sm">
            <div className="font-semibold mb-1">
              {flagged.length} issue{flagged.length > 1 ? 's are' : ' is'} still flagged on the Verification Checklist.
            </div>
            Resolve the flagged issues and clear them from the checklist before verifying, or place the request on hold.
            <div className="mt-2">
              <button
                type="button"
                id="clear-checklist-btn"
                onClick={() => { setFlagged([]); setVerifyWarning(false) }}
                className="text-xs font-semibold underline"
              >
                Clear all flagged issues
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SENDER-ACCOUNT COLLECTING MODAL (Approve / Verify) ──── */}
      {availableActions.filter(a => SENDER_ACCOUNT_ACTIONS.includes(a.action)).map(({ action, target }) => {
        const senderEditable = canEditSenderAccount(currentStatus, action, hasExistingSender)
        const senderRequired = isSenderAccountRequired(currentStatus, action)
        return (
        <Modal key={action} open={activeAction === action} onClose={closeModal} title={`Confirm ${ACTION_LABELS[action]}`}>
          <div className="mb-5 p-4 rounded-xl space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <label className="form-label block text-xs font-semibold">
              Source Debit Account {senderRequired ? <span style={{ color: '#991B1B' }}>(Compulsory)</span> : ''}
            </label>
            {senderRequired && currentStatus === STATUS.PENDING_PA && (
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {hasExistingSender
                  ? 'Selected by the Department COM. Keep it, or choose another account.'
                  : 'The Department COM did not select an account for this earlier request — please select it now.'}
              </p>
            )}

            {!senderEditable ? (
              /* Read-Only State: the Passing Authority's account is final from the Supervisor stage on */
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
        )
      })}

      {/* ── HOLD MODAL (Required Reason) ────────────────────────── */}
      {availableActions.filter(a => a.action === ACTION.HOLD).map(({ action, target }) => (
        <Modal key="hold" open={activeAction === action} onClose={closeModal} title="Place Request on Hold">
          <div className="mb-4">
            <div className="form-label">Select all applicable reasons *</div>
            <ReasonCheckboxes
              idPrefix="hold-reason"
              selected={holdReasons}
              onToggle={reason => updateHoldDraft(toggleIn(holdReasons, reason), holdOther)}
              disabled={loading}
            />
            {holdReasons.includes(HOLD_REASON_OTHER) && (
              <div className="mt-2 pl-3">
                <label className="form-label" htmlFor="hold-other-reason">Other reason — please explain *</label>
                <textarea
                  id="hold-other-reason"
                  className="form-input"
                  rows={2}
                  placeholder="Describe the issue"
                  value={holdOther}
                  onChange={e => updateHoldDraft(holdReasons, e.target.value)}
                  style={{ resize: 'vertical', minHeight: 56 }}
                />
              </div>
            )}
          </div>
          <div className="mb-4">
            <div className="flex items-center justify-between gap-2">
              <label className="form-label" htmlFor="hold-reason">Hold Remarks *</label>
              {remarksEdited && holdGenerated && (
                <button type="button" onClick={resetHoldRemarks} className="text-xs font-semibold underline mb-1" style={{ color: 'var(--saffron)' }}>
                  Reset to selected reasons
                </button>
              )}
            </div>
            <textarea
              id="hold-reason"
              className="form-input"
              rows={6}
              placeholder="Selected reasons appear here. Edit or expand them before confirming."
              value={holdRemarks}
              onChange={e => setHoldRemarks(e.target.value)}
              style={{ resize: 'vertical', minHeight: 120 }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {remarksEdited
                ? 'You have edited these remarks — newly selected reasons are added at the end; your text is kept.'
                : 'The applicant will see these remarks.'}
            </p>
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
            Confirm that the payment for this Supervisor-verified request has been disbursed successfully.
            This completes the request and is recorded against your name. This action is final.
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
              {loading ? 'Processing…' : `Confirm & ${ACTION_LABELS[action]}`}
            </button>
          </div>
        </Modal>
      ))}
    </>
  )
}
