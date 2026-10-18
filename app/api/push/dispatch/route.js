import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { dispatchPushEvents, purgeProcessedPushEvents } from '@/lib/push/dispatch'

export const maxDuration = 60

// GET /api/push/dispatch — optional manual/external RECOVERY endpoint; it is not
// scheduled and normal delivery never depends on it (every workflow action delivers
// its own notifications immediately). It processes only events still pending and
// claims only deliveries not yet sent, so it can never resend a completed delivery.
// Auth: `Authorization: Bearer $PUSH_DISPATCH_SECRET`.
function isAuthorized(request) {
  const secret = process.env.PUSH_DISPATCH_SECRET
  if (!secret) return false
  const given = Buffer.from(request.headers.get('authorization') || '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let processed = 0
  // Drain in batches; bounded so one run cannot exceed the function's time limit.
  for (let i = 0; i < 5; i++) {
    // minAge leaves brand-new events to the post-response dispatch of the route that created them.
    const result = await dispatchPushEvents({ limit: 25, minAgeSeconds: 30 })
    processed += result.processed
    if (result.processed < 25) break
  }
  await purgeProcessedPushEvents()

  return NextResponse.json({ processed })
}
