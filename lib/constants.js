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

export const STATUS_LABELS = {
  pending_com: 'Pending COM',
  pending_pa:  'Pending PA',
  pending_ah:  'Pending Accounts Head',
  approved:    'Approved',
  rejected:    'Rejected',
};

export const STATUS_COLORS = {
  pending_com: 'amber',
  pending_pa:  'blue',
  pending_ah:  'purple',
  approved:    'emerald',
  rejected:    'red',
};

export const ACTION_LABELS = {
  submitted:    'Submitted',
  com_approved: 'COM Approved',
  com_rejected: 'COM Rejected',
  pa_approved:  'PA Approved',
  pa_rejected:  'PA Rejected',
  ah_approved:  'Accounts Head Approved',
  ah_rejected:  'Accounts Head Rejected',
};

export const ACTION_COLORS = {
  submitted:    'blue',
  com_approved: 'emerald',
  com_rejected: 'red',
  pa_approved:  'emerald',
  pa_rejected:  'red',
  ah_approved:  'emerald',
  ah_rejected:  'red',
};

// Which role acts at which status
export const APPROVE_TRANSITIONS = {
  department_com:    { from: 'pending_com', to: 'pending_pa', action: 'com_approved' },
  passing_authority: { from: 'pending_pa',  to: 'pending_ah', action: 'pa_approved'  },
  accounts_head:     { from: 'pending_ah',  to: 'approved',   action: 'ah_approved'  },
};

export const REJECT_TRANSITIONS = {
  department_com:    { from: 'pending_com', action: 'com_rejected' },
  passing_authority: { from: 'pending_pa',  action: 'pa_rejected'  },
  accounts_head:     { from: 'pending_ah',  action: 'ah_rejected'  },
};
