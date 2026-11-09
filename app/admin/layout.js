import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { requireActiveProfile, getUserRolesAndScopes, getMyQueue } from '@/lib/utils'
import { ROLES_DB } from '@/lib/constants'

export default async function AdminLayout({ children }) {
  const { user, profile } = await requireActiveProfile()
  if (!user) redirect('/login')

  const userRoles = await getUserRolesAndScopes(user.id) || []

  const isSuperAdmin = userRoles.some(ur => ur.role === ROLES_DB.super_admin)
  if (!isSuperAdmin) redirect('/dashboard')

  const myQueue = await getMyQueue(userRoles)

  return (
    <AppShell profile={profile} userRoles={userRoles} queueCount={myQueue.length}>
      {children}
    </AppShell>
  )
}
