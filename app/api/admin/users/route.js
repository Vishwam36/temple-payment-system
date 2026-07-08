// app/api/admin/users/route.js

import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Helper to assert that the calling user is actually a Super Admin
async function verifySuperAdmin(admin) {
  const supabase = await createServerClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { error: 'Unauthorized', status: 401 }

  // Query roles table via cross-relation join to find 'super_admin' string
  const { data: profile } = await admin
    .from('profiles')
    .select('*, user_roles(role)')
    .eq('id', user.id)
    .single()

  const userRoles = profile?.user_roles?.map(ur => ur.role) || []
  if (!userRoles.includes('super_admin')) {
    return { error: 'Forbidden', status: 403 }
  }

  return { authorized: true }
}

// 1. GET /api/admin/users — Returns full user picker directory + master assignments list
export async function GET() {
  const admin = createAdminServerClient()
  const authStatus = await verifySuperAdmin(admin)
  if (authStatus.error) return NextResponse.json({ error: authStatus.error }, { status: authStatus.status })

  // Query A: Get all base user profiles for the creation select dropdown
  const { data: users, error: userErr } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .order('created_at', { ascending: false })

  if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 })

  // Query B: Get all role assignments joined with parent user identity fields
  const { data: assignments, error: assignErr } = await admin
    .from('user_roles')
    .select(`
      id,
      role,
      department,
      created_at,
      profiles (
        id,
        email,
        full_name
      )
    `)
    .order('created_at', { ascending: false })

  if (assignErr) return NextResponse.json({ error: assignErr.message }, { status: 500 })

  return NextResponse.json({ users, assignments })
}

// 2. POST /api/admin/users — Provisions/appends a brand new role map mapping rule
export async function POST(request) {
  const admin = createAdminServerClient()
  const authStatus = await verifySuperAdmin(admin)
  if (authStatus.error) return NextResponse.json({ error: authStatus.error }, { status: authStatus.status })

  const body = await request.json().catch(() => ({}))
  const { userId, role, department } = body

  if (!userId || !role) {
    return NextResponse.json({ error: 'userId and role are required parameters' }, { status: 400 })
  }

  if (role === 'department_com' && !department) {
    return NextResponse.json({ error: 'Department COMs must be assigned a valid department scope.' }, { status: 400 })
  }

  // Clear input parameters if the assigned role does not require scope tracking 
  const processedDepartment = role === 'department_com' ? department : null

  // Insert mapping rule directly into the Many-to-Many junction table
  const { error } = await admin
    .from('user_roles')
    .insert({
      profile_id: userId,
      role: role,
      department: processedDepartment
    })

  if (error) {
    // Catch explicit DB level Postgres unique constraint violations (profile_id, role, department conflict)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This exact role mapping rule already exists for this user profile.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// 3. DELETE /api/admin/users — Strips/revokes a specific role assignment mapping line item
export async function DELETE(request) {
  const admin = createAdminServerClient()
  const authStatus = await verifySuperAdmin(admin)
  if (authStatus.error) return NextResponse.json({ error: authStatus.error }, { status: authStatus.status })

  // Parse assignment record ID query parameter out of request URL line
  const { searchParams } = new URL(request.url)
  const assignmentId = searchParams.get('id')

  if (!assignmentId) {
    return NextResponse.json({ error: 'Target assignment unique row ID parameter missing.' }, { status: 400 })
  }

  const { error } = await admin
    .from('user_roles')
    .delete()
    .eq('id', assignmentId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}