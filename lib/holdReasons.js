// Shared by the Supervisor's Verification Checklist / Hold modal and the PATCH API,
// so the client and server agree on what a valid multi-reason hold looks like.
// Pure — unit-tested (tests/hold/*.test.mjs); the relative import carries its extension so Node can load it.
import { PREDEFINED_HOLD_REASONS, HOLD_REASON_OTHER, HOLD_REASON_MIN_LENGTH } from './constants.js'

// Keeps only known reasons, de-duplicated, in the canonical checklist order.
export const normalizeHoldReasons = (reasons) => {
  if (!Array.isArray(reasons)) return []
  return PREDEFINED_HOLD_REASONS.filter(r => reasons.includes(r))
}

// One paragraph per selected reason; "Other reason" contributes the custom explanation.
export const buildHoldRemarks = (reasons, otherText = '') => {
  const other = otherText.trim()
  return normalizeHoldReasons(reasons)
    .map(r => r === HOLD_REASON_OTHER ? (other ? `${HOLD_REASON_OTHER}: ${other}` : '') : r)
    .filter(Boolean)
    .join('\n\n')
}

// Returns an error message, or null when the hold submission is valid.
export const validateHoldSubmission = ({ reasons, otherText = '', remarks = '' }) => {
  if (!Array.isArray(reasons) || reasons.some(r => !PREDEFINED_HOLD_REASONS.includes(r))) {
    return 'Hold reasons must be chosen from the predefined list.'
  }
  if (normalizeHoldReasons(reasons).length === 0) return 'Select at least one hold reason.'

  const other = (otherText || '').trim()
  if (reasons.includes(HOLD_REASON_OTHER)) {
    if (!other) return 'Please explain the "Other reason".'
    if (!(remarks || '').includes(other)) return 'The Hold Remarks must include your "Other reason" explanation.'
  }

  if ((remarks || '').trim().length < HOLD_REASON_MIN_LENGTH) return 'Hold Remarks are required.'
  return null
}
