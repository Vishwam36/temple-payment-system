export const DEPARTMENTS = [
  'Guest House',
  'Govindas',
  'Gift Shop',
  'Devotee Kitchen',
  'Sweet Shop',
  'Seva Office',
  'Vehicles',
  'Goshala',
  'Deity',
  'BBT',
  'Yagya',
  'Accounts',
  'Miscellaneous'
];

export const ROLES = {
  applicant: 'Applicant',
  department_com: 'Department COM',
  passing_authority: 'Passing Authority',
  supervisor: 'Supervisor',
  accounts_head: 'Accounts Verifier',
  super_admin: 'Super Admin',
};

export const ROLES_DB = {
  applicant: 'applicant',
  department_com: 'department_com',
  passing_authority: 'passing_authority',
  supervisor: 'supervisor',
  accounts_head: 'accounts_head',
  super_admin: 'super_admin',
};

// Roles with organisation-wide (non-department-scoped) visibility and authority
export const GLOBAL_ROLES = [ROLES_DB.super_admin, ROLES_DB.supervisor, ROLES_DB.accounts_head, ROLES_DB.passing_authority];

// ── PAYMENT REQUEST STATUS LIFECYCLE ──────────────────────────────
export const STATUS = {
  PENDING_COM: 'pending_com',
  PENDING_PA: 'pending_pa',
  // DB value kept as 'pending_ah' so in-flight rows need no migration; this stage
  // is now owned by the Supervisor (it was the Accounts Verifier's review stage).
  PENDING_SUPERVISOR: 'pending_ah',
  ON_HOLD: 'on_hold',
  VERIFIED: 'verified',
  SUCCESSFUL: 'successful',
  REJECTED: 'rejected',
};

export const TERMINAL_STATUSES = [STATUS.SUCCESSFUL, STATUS.REJECTED];

// The three early-stage approval statuses, grouped for the dashboard's "Pending" stat
// and the requests-list filter (a request in any of these is "awaiting approval").
export const PENDING_STATUS_GROUP = [STATUS.PENDING_COM, STATUS.PENDING_PA, STATUS.PENDING_SUPERVISOR];

export const STATUS_LABELS = {
  [STATUS.PENDING_COM]: 'Pending Department COM',
  [STATUS.PENDING_PA]: 'Pending Passing Authority',
  [STATUS.PENDING_SUPERVISOR]: 'Pending Supervisor',
  [STATUS.ON_HOLD]: 'On Hold',
  [STATUS.VERIFIED]: 'Verified (Awaiting Payment)',
  [STATUS.SUCCESSFUL]: 'Successful',
  [STATUS.REJECTED]: 'Rejected',
};

// Badge color keys — rendered via .badge-{color} classes in globals.css
export const STATUS_COLORS = {
  [STATUS.PENDING_COM]: 'amber',
  [STATUS.PENDING_PA]: 'blue',
  [STATUS.PENDING_SUPERVISOR]: 'purple',
  [STATUS.ON_HOLD]: 'yellow',
  [STATUS.VERIFIED]: 'indigo',
  [STATUS.SUCCESSFUL]: 'emerald',
  [STATUS.REJECTED]: 'red',
};

export const HOLD_REASON_MIN_LENGTH = 1;

// Predefined hold reasons offered as a convenience in the Hold modal. Selecting
// one pre-fills the (still editable) reason textbox; OTHER leaves it blank.
export const HOLD_REASON_OTHER = 'Other reason';
export const PREDEFINED_HOLD_REASONS = [
  'Voucher is improperly filled',
  'COM signature is missing',
  'Sanctioning authorities signature is missing',
  'Previous bill is NOT submitted yet',
  'Previous advances are NOT settled yet',
  'Current bill submitted is NOT proper',
  HOLD_REASON_OTHER,
];
export const REJECTION_REASON_MIN_LENGTH = 1;

// Bank account format checks — mirrored by DB CHECK constraints on
// payment_requests / frequently_used_accounts, enforced here too so bad
// input is rejected with a clear message before it ever reaches the DB.
export const ACCOUNT_NO_REGEX = /^[0-9]{6,20}$/;
export const IFSC_CODE_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// Directional state machine — the single source of truth for legal transitions.
// Enforced server-side on every status update; drives the client action deck too.
export const STATUS_TRANSITIONS = {
  [STATUS.PENDING_COM]: [STATUS.PENDING_PA, STATUS.REJECTED],
  [STATUS.PENDING_PA]: [STATUS.PENDING_SUPERVISOR, STATUS.REJECTED],
  [STATUS.PENDING_SUPERVISOR]: [STATUS.ON_HOLD, STATUS.VERIFIED, STATUS.REJECTED],
  [STATUS.ON_HOLD]: [STATUS.VERIFIED, STATUS.REJECTED],
  [STATUS.VERIFIED]: [STATUS.SUCCESSFUL, STATUS.REJECTED],
};

// Roles (besides super_admin, which always has authority) allowed to act
// while a request sits at a given status. Supervisor owns review (hold/verify);
// the Accounts Verifier only confirms payment once a request is verified.
export const STAGE_OWNER_ROLES = {
  [STATUS.PENDING_COM]: [ROLES_DB.department_com],
  [STATUS.PENDING_PA]: [ROLES_DB.passing_authority],
  [STATUS.PENDING_SUPERVISOR]: [ROLES_DB.supervisor],
  [STATUS.ON_HOLD]: [ROLES_DB.supervisor],
  [STATUS.VERIFIED]: [ROLES_DB.accounts_head],
};

// Action identifiers driving the ApprovalActions control deck
export const ACTION = {
  APPROVE: 'approve',
  VERIFY: 'verify',
  HOLD: 'hold',
  MARK_SUCCESSFUL: 'mark_successful',
  REJECT: 'reject',
};

export const ACTION_LABELS = {
  [ACTION.APPROVE]: 'Approve',
  [ACTION.VERIFY]: 'Verify',
  [ACTION.HOLD]: 'Hold',
  [ACTION.MARK_SUCCESSFUL]: 'Mark Payment Successful',
  [ACTION.REJECT]: 'Reject',
};

// Available actions per status, and the status each one resolves to.
export const STATUS_ACTIONS = {
  [STATUS.PENDING_COM]: [
    { action: ACTION.APPROVE, target: STATUS.PENDING_PA },
    { action: ACTION.REJECT, target: STATUS.REJECTED },
  ],
  [STATUS.PENDING_PA]: [
    { action: ACTION.APPROVE, target: STATUS.PENDING_SUPERVISOR },
    { action: ACTION.REJECT, target: STATUS.REJECTED },
  ],
  [STATUS.PENDING_SUPERVISOR]: [
    { action: ACTION.VERIFY, target: STATUS.VERIFIED },
    { action: ACTION.HOLD, target: STATUS.ON_HOLD },
    { action: ACTION.REJECT, target: STATUS.REJECTED },
  ],
  [STATUS.ON_HOLD]: [
    { action: ACTION.VERIFY, target: STATUS.VERIFIED },
    { action: ACTION.REJECT, target: STATUS.REJECTED },
  ],
  [STATUS.VERIFIED]: [
    { action: ACTION.MARK_SUCCESSFUL, target: STATUS.SUCCESSFUL },
    { action: ACTION.REJECT, target: STATUS.REJECTED },
  ],
};

// Actions in which a sender (debit) account may/must be attached to the request
export const SENDER_ACCOUNT_ACTIONS = [ACTION.APPROVE, ACTION.VERIFY];
