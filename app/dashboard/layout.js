// app/dashboard/layout.js
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { requireActiveProfile, getUserRolesAndScopes, getMyQueue } from '@/lib/utils'

export default async function DashboardLayout({ children }) {
  const { user, profile } = await requireActiveProfile()
  if (!user) redirect('/login')

  const roleRows = await getUserRolesAndScopes(user.id)
  // Sidebar My Queue badge; refreshed with the layout after every action (router.refresh)
  const myQueue = await getMyQueue(roleRows)

  return (
    <AppShell profile={profile} userRoles={roleRows || []} queueCount={myQueue.length}>
      {children}
    </AppShell>
  )
}
