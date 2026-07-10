import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants'

export function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] || status
  const color = STATUS_COLORS[status] || 'gold'
  return <span className={`badge badge-${color}`}><span>●</span>{label}</span>
}
