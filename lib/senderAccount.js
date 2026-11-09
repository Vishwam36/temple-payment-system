// Shared by the approval modal (ApprovalActions) and the PATCH API, so the client and
// server agree on who must / may set the sender (debit) account at each stage.
// Pure — unit-tested (tests/sender/*.test.mjs); the relative import carries its extension so Node can load it.
import { STATUS, ACTION, ACCOUNT_NO_REGEX, IFSC_CODE_REGEX } from './constants.js'

export const SENDER_ACCOUNT_REQUIRED_MESSAGE = 'Please select the Debit Account.'

// Department COM must choose the account; Passing Authority may keep or replace it.
// A Passing Authority also fills it for older requests the COM approved without one.
export const SENDER_EDIT_STAGES = [STATUS.PENDING_COM, STATUS.PENDING_PA]

const trimmed = (v) => typeof v === 'string' ? v.trim() : ''

export const normalizeSenderAccount = ({ account_no, ifsc_code, account_holder } = {}) => ({
  account_no: trimmed(account_no),
  ifsc_code: trimmed(ifsc_code).toUpperCase(),
  account_holder: trimmed(account_holder),
})

export const isSenderAccountComplete = (acc) => !!(acc?.account_no && acc?.ifsc_code && acc?.account_holder)

export const sameSenderAccount = (a, b) => {
  const x = normalizeSenderAccount(a || {})
  const y = normalizeSenderAccount(b || {})
  return x.account_no === y.account_no && x.ifsc_code === y.ifsc_code && x.account_holder === y.account_holder
}

// Returns an error message for a normalized, complete account, or null when it is valid.
export const getSenderAccountFormatError = (acc) => {
  if (!ACCOUNT_NO_REGEX.test(acc.account_no)) return 'Sender account number must be numeric (6-20 digits).'
  if (!IFSC_CODE_REGEX.test(acc.ifsc_code)) return 'Sender IFSC code format is invalid (e.g. SBIN0001234).'
  return null
}

// Approve at the COM / PA stage requires an account; Verify may only attach one when none is stored.
export const isSenderAccountRequired = (status, action) =>
  action === ACTION.APPROVE && SENDER_EDIT_STAGES.includes(status)

export const canEditSenderAccount = (status, action, hasExisting) =>
  isSenderAccountRequired(status, action) || (action === ACTION.VERIFY && !hasExisting)

// Server-side rule for a sender-account action (approve / verify).
//   provided — { account_no, ifsc_code, account_holder } from the request body (any may be undefined)
//   existing — the same fields as currently stored on the request
// Returns { error } or { update } (the sender columns to write with the status change; {} = keep).
export const resolveSenderAccountUpdate = ({ status, action, provided = {}, existing = {} }) => {
  const anyProvided = ['account_no', 'ifsc_code', 'account_holder'].some(k => provided[k] !== undefined && provided[k] !== null)
  const stored = normalizeSenderAccount(existing)
  const hasExisting = !!stored.account_no

  if (anyProvided) {
    if (!canEditSenderAccount(status, action, hasExisting)) {
      return { error: 'The Debit Account was finalised by the Passing Authority and cannot be changed at this stage.' }
    }
    const acc = normalizeSenderAccount(provided)
    if (!isSenderAccountComplete(acc)) {
      return { error: 'Sender account number, IFSC code and account holder name must all be provided together.' }
    }
    const formatError = getSenderAccountFormatError(acc)
    if (formatError) return { error: formatError }
    return { update: { sender_account_no: acc.account_no, sender_ifsc_code: acc.ifsc_code, sender_account_holder: acc.account_holder } }
  }

  if (!isSenderAccountRequired(status, action)) return { update: {} }

  // The COM must choose the account explicitly with the approval — nothing is inherited.
  if (status === STATUS.PENDING_COM) return { error: SENDER_ACCOUNT_REQUIRED_MESSAGE }

  // Passing Authority keeping the stored account: it must still be a complete, valid one.
  if (!isSenderAccountComplete(stored) || getSenderAccountFormatError(stored)) {
    return { error: SENDER_ACCOUNT_REQUIRED_MESSAGE }
  }
  return { update: {} }
}
