import Link from 'next/link'
import { Inbox, LayoutDashboard, RotateCcw } from 'lucide-react'
import { myQueueHref } from '@/lib/queue'

// Shown when Next Task has nothing further to open. `remaining` counts tasks still
// awaiting the user in this queue view that lie before the current position (skipped,
// still on hold, or newly arrived); `restartHref` re-walks them from the top on request.
// `otherDepts` counts tasks hidden by a department filter.
export default function QueueCaughtUp({ ctx, remaining = 0, otherDepts = 0, restartHref }) {
  const caughtUp = remaining === 0

  return (
    <div className="glass-card rounded-xl p-6 text-center" role="status">
      <div className="text-4xl mb-3">{caughtUp ? '🎉' : '🏁'}</div>
      <h2 className="text-lg font-bold gradient-text">{caughtUp ? 'All Caught Up!' : 'End of Queue'}</h2>
      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
        {caughtUp
          ? `You have completed all tasks currently awaiting your action${ctx?.dept && ctx.dept !== 'all' ? ` in ${ctx.dept}` : ''}.`
          : `${remaining} task${remaining === 1 ? ' is' : 's are'} still awaiting your action — skipped, still on hold, or newly arrived.`}
      </p>
      {caughtUp && otherDepts > 0 && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          {otherDepts} more task{otherDepts === 1 ? '' : 's'} await you in other departments.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-3 mt-5">
        {!caughtUp && restartHref && (
          <Link href={restartHref} prefetch={false} className="btn-primary">
            <RotateCcw size={16} /> Start Again from Top
          </Link>
        )}
        <Link href={caughtUp && otherDepts > 0 ? myQueueHref({ sort: ctx?.sort }) : myQueueHref(ctx)} className="btn-secondary">
          <Inbox size={16} /> Back to My Queue
        </Link>
        {caughtUp && (
          <Link href="/dashboard" className="btn-secondary">
            <LayoutDashboard size={16} /> Go to Dashboard
          </Link>
        )}
      </div>
    </div>
  )
}
