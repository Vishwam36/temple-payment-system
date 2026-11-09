// app/requests/queue/page.js

import { createAdminServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import QueueCaughtUp from '@/components/requests/QueueCaughtUp'
import { getSessionUser, getUserRolesAndScopes, getMyQueue } from '@/lib/utils'
import { parseQueueContext, findNextTask, queueTaskHref, nextTaskHref } from '@/lib/queue'

// Next Task resolver: /requests/queue?after=<request id>[&sort=…&dept=…]
// Resolves the next task against the user's queue as it stands *now* (not a snapshot taken
// when the previous page loaded), so tasks processed by someone else, or no longer within
// the user's authority, are skipped. Without `after` it opens the first task in the queue.
export default async function NextTaskPage({ searchParams }) {
  const resolvedSearchParams = await searchParams
  const ctx = parseQueueContext(resolvedSearchParams)
  const afterId = typeof resolvedSearchParams?.after === 'string' ? resolvedSearchParams.after : null

  const user = await getSessionUser()
  if (!user) redirect('/login')

  // The cursor is just a position in the queue order. Its sort keys are looked up alongside
  // the queue (needed when the previous request has left it, e.g. just approved); nothing
  // else about it is exposed.
  const [roleRows, cursorRes] = await Promise.all([
    getUserRolesAndScopes(user.id),
    afterId
      ? createAdminServerClient().from('payment_requests').select('id, created_at, amount').eq('id', afterId).maybeSingle()
      : null,
  ])
  const myQueue = await getMyQueue(roleRows)

  let cursor = null
  if (afterId) cursor = myQueue.find(r => r.id === afterId) || cursorRes?.data || null

  const { next, remaining } = findNextTask(myQueue, cursor, ctx)
  if (next) redirect(queueTaskHref(next.id, ctx))

  // Nothing after the cursor. Any tasks left lie before it in this view (skipped / on hold /
  // newly arrived); the previous request itself still counts if it awaits the user.
  const cursorPending = !!cursor && myQueue.some(r => r.id === cursor.id &&
    (ctx.dept === 'all' || r.department === ctx.dept))
  const left = remaining + (cursorPending ? 1 : 0)
  const otherDepts = ctx.dept === 'all' ? 0 : myQueue.filter(r => r.department !== ctx.dept).length

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold gradient-text mb-6">My Queue</h1>
      <QueueCaughtUp
        ctx={ctx}
        remaining={left}
        otherDepts={otherDepts}
        restartHref={left > 0 ? nextTaskHref(null, ctx) : null}
      />
    </div>
  )
}
