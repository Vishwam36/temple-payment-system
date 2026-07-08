import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { createAdminServerClient } from '@/lib/supabase/server'

export default async function RequestsLayout({ children }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const admin = createAdminServerClient()

  // Concurrently pull profile meta and full authorization list
  const [profileRes, rolesRes] = await Promise.all([
    admin.from('profiles').select('full_name, email').eq('id', user.id).single(),
    admin.from('user_roles').select('role, department').eq('profile_id', user.id)
  ])

  return (
    <AppShell
      profile={profileRes.data}
      userRoles={rolesRes.data || []}
    >
      {children}
    </AppShell>
  )
}
