import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { requireActiveProfile, getUserRolesAndScopes } from '@/lib/utils'

export default async function RequestsLayout({ children }) {
  const { user, profile } = await requireActiveProfile()
  if (!user) redirect('/login')

  const roleRows = await getUserRolesAndScopes(user.id)

  return (
    <AppShell profile={profile} userRoles={roleRows || []}>
      {children}
    </AppShell>
  )
}
