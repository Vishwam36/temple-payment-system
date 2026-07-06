import { STATUS_LABELS, STATUS_COLORS, ACTION_LABELS, ACTION_COLORS } from '@/lib/constants'

export function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] || status
  const color = STATUS_COLORS[status] || 'gold'
  return <span className={`badge badge-${color}`}><span>●</span>{label}</span>
}

export function ActionBadge({ action }) {
  const label = ACTION_LABELS[action] || action
  const color = ACTION_COLORS[action] || 'gold'
  return <span className={`badge badge-${color}`}>{label}</span>
}
