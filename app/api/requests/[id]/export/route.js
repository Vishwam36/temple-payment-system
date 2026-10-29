import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getUserRolesAndScopes } from '@/lib/utils'
import {
  EXPORT_FIELDS, canExportPaymentFile, getExportBlocker, buildPaymentXls,
  buildExportFileName, buildContentDisposition
} from '@/lib/paymentExport'

// GET /api/requests/[id]/export — download the single-request bank payment file (.xls).
// Read-only: every value comes from the database (nothing from the client), the file is
// built in memory and streamed back, and the request row is never modified.
export async function GET(request, context) {
  const params = await context.params
  const requestId = params.id

  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. Only the Accounts Verifier and Super Admin may obtain banking files. Both are
  // organisation-wide roles, so they can access every request (see GLOBAL_ROLES).
  const roleRows = await getUserRolesAndScopes(user.id)
  if (!canExportPaymentFile(roleRows)) {
    return NextResponse.json({ error: 'Forbidden: You do not have permission to export payment files.' }, { status: 403 })
  }

  const admin = createAdminServerClient()

  const { data: req, error: reqErr } = await admin
    .from('payment_requests').select(EXPORT_FIELDS).eq('id', requestId).single()
  if (reqErr || !req) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

  // 2. Stage + data validation — banking details are never altered to make them fit
  const blocker = getExportBlocker(req)
  if (blocker) return NextResponse.json({ error: blocker }, { status: 422 })

  const file = buildPaymentXls(req)

  return new NextResponse(file, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.ms-excel',
      'Content-Disposition': buildContentDisposition(buildExportFileName(req)),
      'Content-Length': String(file.length),
      'Cache-Control': 'no-store, private',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
