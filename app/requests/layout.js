import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { createAdminServerClient } from '@/lib/supabase/server'

export default async function RequestsLayout({ children }) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const admin = createAdminServerClient()
  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).single()
  return <AppShell profile={profile}>{children}</AppShell>
}
