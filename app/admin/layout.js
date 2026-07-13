import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { requireActiveProfile, getUserRolesAndScopes } from '@/lib/utils'
import { ROLES_DB } from '@/lib/constants'

export default async function AdminLayout({ children }) {
  const { user, profile } = await requireActiveProfile()
  if (!user) redirect('/login')

  const userRoles = await getUserRolesAndScopes(user.id) || []

  const isSuperAdmin = userRoles.some(ur => ur.role === ROLES_DB.super_admin)
  if (!isSuperAdmin) redirect('/dashboard')

  return (
    <AppShell profile={profile} userRoles={userRoles}>
      {children}
    </AppShell>
  )
}
