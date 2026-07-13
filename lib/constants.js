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
];

export const ROLES = {
  applicant: 'Applicant',
  department_com: 'Department COM',
  passing_authority: 'Passing Authority',
  accounts_head: 'Accounts Head',
  super_admin: 'Super Admin',
};

export const ROLES_DB = {
  applicant: 'applicant',
  department_com: 'department_com',
  passing_authority: 'passing_authority',
  accounts_head: 'accounts_head',
  super_admin: 'super_admin',
};

// ── PAYMENT REQUEST STATUS LIFECYCLE ──────────────────────────────
export const STATUS = {
  PENDING_COM: 'pending_com',
  PENDING_PA: 'pending_pa',
  PENDING_AH: 'pending_ah',
  ON_HOLD: 'on_hold',
  VERIFIED: 'verified',
  SUCCESSFUL: 'successful',
  REJECTED: 'rejected',
};

export const TERMINAL_STATUSES = [STATUS.SUCCESSFUL, STATUS.REJECTED];

export const STATUS_LABELS = {
  [STATUS.PENDING_COM]: 'Pending Department COM',
  [STATUS.PENDING_PA]: 'Pending Passing Authority',
  [STATUS.PENDING_AH]: 'Pending Accounts Head',
  [STATUS.ON_HOLD]: 'On Hold',
  [STATUS.VERIFIED]: 'Verified (Processing)',
  [STATUS.SUCCESSFUL]: 'Successful',
  [STATUS.REJECTED]: 'Rejected',
};

// Badge color keys — rendered via .badge-{color} classes in globals.css
export const STATUS_COLORS = {
  [STATUS.PENDING_COM]: 'amber',
  [STATUS.PENDING_PA]: 'blue',
  [STATUS.PENDING_AH]: 'purple',
  [STATUS.ON_HOLD]: 'yellow',
  [STATUS.VERIFIED]: 'indigo',
  [STATUS.SUCCESSFUL]: 'emerald',
  [STATUS.REJECTED]: 'red',
};

export const HOLD_REASON_MIN_LENGTH = 1;
export const REJECTION_REASON_MIN_LENGTH = 1;

// Directional state machine — the single source of truth for legal transitions.
// Enforced server-side on every status update; drives the client action deck too.
export const STATUS_TRANSITIONS = {
  [STATUS.PENDING_COM]: [STATUS.PENDING_PA, STATUS.REJECTED],
  [STATUS.PENDING_PA]: [STATUS.PENDING_AH, STATUS.REJECTED],
  [STATUS.PENDING_AH]: [STATUS.ON_HOLD, STATUS.VERIFIED, STATUS.REJECTED],
  [STATUS.ON_HOLD]: [STATUS.VERIFIED, STATUS.REJECTED],
  [STATUS.VERIFIED]: [STATUS.SUCCESSFUL, STATUS.REJECTED],
};

// Roles (besides super_admin, which always has authority) allowed to act
// while a request sits at a given status.
export const STAGE_OWNER_ROLES = {
  [STATUS.PENDING_COM]: [ROLES_DB.department_com],
  [STATUS.PENDING_PA]: [ROLES_DB.passing_authority],
  [STATUS.PENDING_AH]: [ROLES_DB.accounts_head],
  [STATUS.ON_HOLD]: [ROLES_DB.accounts_head],
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
  [ACTION.MARK_SUCCESSFUL]: 'Mark Successful',
  [ACTION.REJECT]: 'Reject',
};

// Available actions per status, and the status each one resolves to.
export const STATUS_ACTIONS = {
  [STATUS.PENDING_COM]: [
    { action: ACTION.APPROVE, target: STATUS.PENDING_PA },
    { action: ACTION.REJECT, target: STATUS.REJECTED },
  ],
  [STATUS.PENDING_PA]: [
    { action: ACTION.APPROVE, target: STATUS.PENDING_AH },
    { action: ACTION.REJECT, target: STATUS.REJECTED },
  ],
  [STATUS.PENDING_AH]: [
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
