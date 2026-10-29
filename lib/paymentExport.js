import * as XLSX from 'xlsx'
import { STATUS, ROLES_DB, ACCOUNT_NO_REGEX, IFSC_CODE_REGEX } from './constants.js'

// ── SINGLE-REQUEST BANK PAYMENT FILE (.xls) ───────────────────────
// One payment request → one genuine BIFF8 (.xls) workbook with a single sheet and a
// single row, laid out in the bank-upload format below. No headers, no extra rows.
//
//   A ISKCON+last 4 of sender a/c   B VPAY   C NEFT   D —   E submission date (DD/MM/YYYY)
//   F —   G sender a/c no (text)   H amount (number)   I M   J —   K receiver holder
//   L —   M receiver IFSC   N receiver a/c no (text)

// Only the Accounts Verifier (the "Accounts In-Charge", who confirms payment) and
// Super Admin may download payment files, and only once a request is payable.
export const EXPORT_ROLES = [ROLES_DB.accounts_head, ROLES_DB.super_admin]
export const EXPORTABLE_STATUSES = [STATUS.VERIFIED, STATUS.SUCCESSFUL]

// Request columns the export reads — nothing else is fetched for it.
export const EXPORT_FIELDS = 'id, status, amount, created_at, sender_account_no, sender_account_holder, receiver_account_no, receiver_ifsc_code, receiver_account_holder'

// Business dates are Indian dates; servers (Vercel) run in UTC, so a request submitted
// at 01:00 IST must not be stamped with the previous day.
const BUSINESS_TIME_ZONE = 'Asia/Kolkata'

export const canExportPaymentFile = (roleRows) => {
  return !!roleRows?.some(r => EXPORT_ROLES.includes(r.role))
}

export const isExportableRequest = (req) => EXPORTABLE_STATUSES.includes(req?.status)

const isNonBlankString = (v) => typeof v === 'string' && v.trim().length > 0

const toAmount = (amount) => {
  if (amount === null || amount === undefined || amount === '') return NaN
  return Number(amount)
}

// Returns a user-facing reason the request cannot be exported, or null when it can.
// Banking details are validated, never corrected — a bad value blocks the export.
export const getExportBlocker = (req) => {
  if (!isExportableRequest(req)) {
    return 'Only verified or paid requests can be exported for bank payment.'
  }
  if (!isNonBlankString(req.sender_account_no) || !isNonBlankString(req.sender_account_holder)) {
    return 'No sender (debit) account is attached to this request yet.'
  }
  if (!ACCOUNT_NO_REGEX.test(req.sender_account_no)) {
    return 'The stored sender account number is not a valid 6-20 digit number.'
  }
  if (!isNonBlankString(req.receiver_account_no) || !isNonBlankString(req.receiver_ifsc_code) || !isNonBlankString(req.receiver_account_holder)) {
    return 'Receiver account details are incomplete on this request.'
  }
  if (!ACCOUNT_NO_REGEX.test(req.receiver_account_no)) {
    return 'The stored receiver account number is not a valid 6-20 digit number.'
  }
  if (!IFSC_CODE_REGEX.test(req.receiver_ifsc_code)) {
    return 'The stored receiver IFSC code is not in a valid format.'
  }
  const amount = toAmount(req.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'The request has no valid payment amount.'
  }
  if (!req.created_at || Number.isNaN(new Date(req.created_at).getTime())) {
    return 'The request has no valid submission date.'
  }
  return null
}

// { dd, mm, yyyy } of the original submission, in Indian time
export const getSubmissionDateParts = (createdAt) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric'
  }).formatToParts(new Date(createdAt))
  const get = (type) => parts.find(p => p.type === type).value
  return { dd: get('day'), mm: get('month'), yyyy: get('year') }
}

// The 14 cell values for columns A..N; null = deliberately blank column.
export const buildBankPaymentRow = (req) => {
  const { dd, mm, yyyy } = getSubmissionDateParts(req.created_at)
  return [
    `ISKCON${req.sender_account_no.slice(-4)}`, // A
    'VPAY',                                     // B
    'NEFT',                                     // C
    null,                                       // D
    `${dd}/${mm}/${yyyy}`,                      // E
    null,                                       // F
    req.sender_account_no,                      // G (text — keeps leading zeros / full precision)
    toAmount(req.amount),                       // H (numeric)
    'M',                                        // I
    null,                                       // J
    req.receiver_account_holder,                // K
    null,                                       // L
    req.receiver_ifsc_code,                     // M
    req.receiver_account_no,                    // N (text)
  ]
}

// Builds the worksheet cell-by-cell so every value has an explicit type: strings stay
// strings (account numbers are never coerced to numbers) and blank columns hold no cell.
export const buildPaymentXls = (req) => {
  const row = buildBankPaymentRow(req)
  const sheet = { '!ref': 'A1:N1' }
  row.forEach((value, i) => {
    if (value === null) return
    const address = XLSX.utils.encode_cell({ r: 0, c: i })
    sheet[address] = typeof value === 'number' ? { t: 'n', v: value } : { t: 's', v: value }
  })

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
  // bookType 'xls' = genuine Excel 97-2003 BIFF8 inside an OLE2 container
  return XLSX.write(workbook, { bookType: 'xls', type: 'buffer' })
}

// Filename-safe segment: drops characters Windows/macOS reject (and commas), turns
// whitespace into underscores, and keeps everything else — including name punctuation
// like dots and non-Latin letters — so names stay recognisable.
export const sanitizeFileNamePart = (value) => {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\\/:*?"<>|,;\u0000-\u001F\u007F]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '')
}

const formatAmountForFileName = (amount) => {
  const n = toAmount(amount)
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

// senderaccname_DDMMYY_amount_acc_holdername.xls
export const buildExportFileName = (req) => {
  const { dd, mm, yyyy } = getSubmissionDateParts(req.created_at)
  return [
    sanitizeFileNamePart(req.sender_account_holder),
    `${dd}${mm}${yyyy.slice(-2)}`,
    formatAmountForFileName(req.amount),
    sanitizeFileNamePart(req.receiver_account_holder),
  ].join('_') + '.xls'
}

// RFC 6266 header: ASCII fallback plus the exact UTF-8 name for modern browsers.
export const buildContentDisposition = (fileName) => {
  const asciiFallback = fileName.normalize('NFKD').replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}
