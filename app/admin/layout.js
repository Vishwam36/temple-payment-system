import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { createAdminServerClient } from '@/lib/supabase/server'
import { ROLES_DB } from '@/lib/constants'

export default async function AdminLayout({ children }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminServerClient()

  // 1. Fetch the profile along with its fully mapped roles and department dimensions
  const { data: profileData } = await admin
    .from('profiles')
    .select('*, user_roles(role, department)')
    .eq('id', user.id)
    .single()

  // 2. Extract the raw matrix array of objects to keep consistency with AppShell
  const userRoles = profileData?.user_roles || []

  // 3. Verify admin access by scanning the object matrix 
  const isSuperAdmin = userRoles.some(ur => ur.role === ROLES_DB.super_admin)

  if (!isSuperAdmin) {
    redirect('/dashboard')
  }

  // 4. Strip out the nested relation field from the profile object to pass clean props
  const { user_roles, ...profile } = profileData || {}

  return (
    <AppShell
      profile={profile}
      userRoles={userRoles}
    >
      {children}
    </AppShell>
  )
}
