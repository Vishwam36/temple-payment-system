'use client'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, CheckCircle, Info } from 'lucide-react'
import { useRequestActivity } from '@/components/requests/RequestActivity'
import QueueCaughtUp from '@/components/requests/QueueCaughtUp'
import { ACTION_SUCCESS_MESSAGES } from '@/lib/constants'
import { myQueueHref, nextTaskHref } from '@/lib/queue'

// Next Task / My Queue controls for a request opened from My Queue. Purely navigation:
// nothing here changes a request. The next task is resolved server-side at click time
// (/requests/queue), so a task processed elsewhere in the meantime is never opened.
//
// Shared props: `remaining` = tasks in this queue view other than the current request,
// `isActionable` = the current request still awaits this user — both computed on the
// server and refreshed after every action.

// Navigates unless an action is mid-submission, confirming first if work is unsaved.
function useGuardedNav() {
  const router = useRouter()
  const activity = useRequestActivity()
  const [pending, startTransition] = useTransition()
  const [target, setTarget] = useState(null) // Which control started the pending navigation

  function goTo(href, from) {
    if (activity?.busy || pending) return
    if (activity?.dirty && !confirm('You have unsaved changes on this request (checklist selections or an open action form). Leave without saving them?')) return
    setTarget(from)
    startTransition(() => router.push(href))
  }
  // pendingFor('next') → true only while the Next Task button's navigation is in flight
  const pendingFor = (from) => pending && target === from
  return { goTo, pending, pendingFor, busy: !!activity?.busy, dirty: !!activity?.dirty }
}

function NextTaskButton({ requestId, ctx, goTo, disabled, pending }) {
  return (
    <button
      type="button"
      id="next-task-btn"
      onClick={() => goTo(nextTaskHref(requestId, ctx), 'next')}
      disabled={disabled}
      className="btn-primary px-4 py-2 text-sm"
      style={{ minHeight: 40 }}
    >
      {pending ? 'Opening…' : <>Next Task <ArrowRight size={16} /></>}
    </button>
  )
}

export function QueueNavBar({ requestId, ctx, remaining, isActionable }) {
  const { goTo, pending, pendingFor, busy, dirty } = useGuardedNav()

  // Also guard reloads / tab closes while there is unsaved work
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const total = remaining + (isActionable ? 1 : 0)
  const scope = ctx.dept !== 'all' ? ` in ${ctx.dept}` : ''

  return (
    <div className="glass-card rounded-xl p-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
      <button
        type="button"
        onClick={() => goTo(myQueueHref(ctx), 'queue')}
        disabled={busy || pending}
        className="btn-secondary px-3 py-2 text-sm"
        style={{ minHeight: 40 }}
      >
        {pendingFor('queue') ? 'Opening…' : <><ArrowLeft size={16} /> My Queue</>}
      </button>
      <span className="text-xs font-semibold w-full sm:w-auto order-last sm:order-none text-center" style={{ color: 'var(--text-muted)' }}>
        {total === 0 ? `No tasks remaining${scope}` : `${total} task${total === 1 ? '' : 's'} remaining${scope}`}
      </span>
      {remaining > 0 ? (
        <NextTaskButton requestId={requestId} ctx={ctx} goTo={goTo} disabled={busy || pending} pending={pendingFor('next')} />
      ) : (
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{isActionable ? 'Last task in queue' : ''}</span>
      )}
    </div>
  )
}

// Feedback beneath the action controls once the user has acted (or the request has
// otherwise left their queue): the success message plus Next Task, or All Caught Up.
export function QueueActionResult({ requestId, ctx, remaining, isActionable, otherDepts }) {
  const activity = useRequestActivity()
  const { goTo, pending, pendingFor, busy } = useGuardedNav()
  const completed = activity?.completed

  if (!completed && isActionable) return null

  return (
    <div className="border-t pt-4 mt-4" style={{ borderColor: 'var(--border)' }}>
      {completed ? (
        <div className="alert alert-success flex items-center gap-2 mb-3" role="status">
          <CheckCircle size={16} style={{ flexShrink: 0 }} /> {ACTION_SUCCESS_MESSAGES[completed] || 'Action saved successfully'}
        </div>
      ) : (
        <div className="alert alert-info flex items-center gap-2 mb-3" role="status">
          <Info size={16} style={{ flexShrink: 0 }} /> This request no longer needs your action.
        </div>
      )}

      {remaining > 0 ? (
        <div className="flex justify-end">
          <NextTaskButton requestId={requestId} ctx={ctx} goTo={goTo} disabled={busy || pending} pending={pendingFor('next')} />
        </div>
      ) : isActionable ? (
        // e.g. the user placed their last task on hold — it stays in their queue
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No other tasks are awaiting your action.</p>
      ) : (
        <QueueCaughtUp ctx={ctx} otherDepts={otherDepts} />
      )}
    </div>
  )
}
