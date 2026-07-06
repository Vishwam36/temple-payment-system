import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RequestTable from '@/components/requests/RequestTable'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export const metadata = { title: 'Requests — Temple Payment System' }

export default async function RequestsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminServerClient()
  const { data: profile } = await admin.from('profiles').select('role,department').eq('id', user.id).single()

  let query = admin
    .from('payment_requests')
    .select('id,status,department,purpose,amount,created_at,applicant_id')
    .order('created_at', { ascending: false })

  if (profile?.role === 'applicant') query = query.eq('applicant_id', user.id)
  else if (profile?.role === 'department_com') query = query.eq('department', profile.department)

  const { data: requests = [] } = await query

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold gradient-text">Payment Requests</h1>
          <p className="text-sm mt-1" style={{color:'var(--text-muted)'}}>
            {profile?.role === 'applicant' ? 'Your submitted requests' :
             profile?.role === 'department_com' ? `${profile.department} department requests` :
             'All department requests'}
          </p>
        </div>
        <Link href="/requests/new" className="btn-primary">
          <Plus size={16} /> New Request
        </Link>
      </div>
      <RequestTable requests={requests} />
    </div>
  )
}
