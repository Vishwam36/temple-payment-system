// Pure ordering / navigation helpers for "My Queue". Shared by the requests list
// (RequestTable) and the Next Task flow so both always walk requests in the same order.
// Which requests belong in the queue is decided elsewhere (isAwaitingUserAction).

export const DEFAULT_SORT = 'date_desc'
export const SORT_OPTIONS = ['date_desc', 'date_asc', 'amount_desc', 'amount_asc']

const byDateDesc = (a, b) => new Date(b.created_at) - new Date(a.created_at)
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

// Comparator for a RequestTable sort option. Ties fall back to newest-first and then id,
// so the order is total — Next Task can locate "the request after this one" exactly.
export const compareRequests = (sort) => (a, b) => {
  let primary = 0
  switch (sort) {
    case 'date_asc': primary = -byDateDesc(a, b); break
    case 'amount_desc': primary = (Number(b.amount) || 0) - (Number(a.amount) || 0); break
    case 'amount_asc': primary = (Number(a.amount) || 0) - (Number(b.amount) || 0); break
    default: primary = byDateDesc(a, b)
  }
  return primary || byDateDesc(a, b) || byId(a, b)
}

// Queue context carried in the URL while processing tasks: { sort, dept }.
// Unknown values fall back to the defaults so a hand-edited URL can't break navigation.
export const parseQueueContext = (params = {}) => ({
  sort: SORT_OPTIONS.includes(params.sort) ? params.sort : DEFAULT_SORT,
  dept: typeof params.dept === 'string' && params.dept && params.dept !== 'all' ? params.dept : 'all',
})

// Query string for a queue context, omitting defaults. `extra` adds further params.
export const queueQuery = ({ sort = DEFAULT_SORT, dept = 'all' } = {}, extra = {}) => {
  const qs = new URLSearchParams()
  Object.entries(extra).forEach(([k, v]) => v != null && qs.set(k, v))
  if (dept !== 'all') qs.set('dept', dept)
  if (sort !== DEFAULT_SORT) qs.set('sort', sort)
  return qs.toString()
}

export const myQueueHref = (ctx) => `/requests?${queueQuery(ctx, { status: 'my_queue' })}`
export const queueTaskHref = (id, ctx) => `/requests/${id}?${queueQuery(ctx, { queue: '1' })}`
export const nextTaskHref = (afterId, ctx) => {
  const qs = queueQuery(ctx, { after: afterId })
  return qs ? `/requests/queue?${qs}` : '/requests/queue'
}

// Given the user's current queue and the request just viewed (`cursor`: id, created_at,
// amount), returns the next task strictly after the cursor in queue order, plus how many
// tasks other than the cursor remain. Moving strictly forward (never wrapping) means
// skipped or on-hold tasks are not cycled through repeatedly; the cursor need not still be
// in the queue (e.g. it was just approved). No cursor → the first task.
export const findNextTask = (queue, cursor, { sort = DEFAULT_SORT, dept = 'all' } = {}) => {
  const cmp = compareRequests(sort)
  const others = (queue || [])
    .filter(r => (dept === 'all' || r.department === dept) && r.id !== cursor?.id)
    .sort(cmp)
  const next = cursor ? others.find(r => cmp(r, cursor) > 0) : others[0]
  return { next: next || null, remaining: others.length }
}
