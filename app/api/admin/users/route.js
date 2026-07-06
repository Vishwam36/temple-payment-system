import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/admin/users
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminServerClient()
  const { data: caller } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await admin
    .from('profiles')
    .select('id, email, full_name, role, department, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data })
}

// PATCH /api/admin/users — update role and/or department
export async function PATCH(request) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminServerClient()
  const { data: caller } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (caller?.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { userId, role, department } = body

  if (!userId || !role) return NextResponse.json({ error: 'userId and role are required' }, { status: 400 })

  // Clear department if role doesn't need it
  const needsDept = role === 'department_com'
  const updateData = {
    role,
    department: needsDept ? (department || null) : null,
  }

  const { error } = await admin.from('profiles').update(updateData).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
