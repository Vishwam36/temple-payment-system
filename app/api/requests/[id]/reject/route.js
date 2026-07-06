import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { REJECT_TRANSITIONS } from '@/lib/constants'

export async function PATCH(request, { params }) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminServerClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const transition = REJECT_TRANSITIONS[profile.role]
  if (!transition) return NextResponse.json({ error: 'Your role cannot reject requests' }, { status: 403 })

  const { data: req } = await admin.from('payment_requests').select('status').eq('id', params.id).single()
  if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  if (req.status !== transition.from) {
    return NextResponse.json({ error: `Cannot reject: request is "${req.status}"` }, { status: 409 })
  }

  const body = await request.json().catch(() => ({}))

  // Mark as rejected
  await admin.from('payment_requests').update({ status: 'rejected' }).eq('id', params.id)

  // Immutable audit row with optional reason
  await admin.from('request_history').insert({
    request_id: params.id,
    actor_id: user.id,
    action: transition.action,
    reason: body.reason || null,
  })

  return NextResponse.json({ success: true, new_status: 'rejected' })
}
