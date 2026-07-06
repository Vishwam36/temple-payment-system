import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'

export default async function HistoryLayout({ children }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const admin = createAdminServerClient()
  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single()
  return <AppShell profile={profile}>{children}</AppShell>
}
