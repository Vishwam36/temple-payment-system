import { StatusBadge } from '@/components/ui/StatusBadge'
import { Eye } from 'lucide-react'
import Link from 'next/link'

export default function RequestTable({ requests }) {
  if (!requests?.length) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <div className="text-4xl mb-3">📭</div>
        <p className="font-semibold" style={{color:'var(--text-secondary)'}}>No requests found</p>
        <p className="text-sm mt-1" style={{color:'var(--text-muted)'}}>Payment requests will appear here</p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Purpose</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id}>
                  <td><span className="badge badge-gold">{r.department}</span></td>
                  <td className="max-w-xs">
                    <span className="line-clamp-2 text-sm" style={{color:'var(--text-primary)'}}>{r.purpose}</span>
                  </td>
                  <td>
                    {r.amount ? (
                      <span className="font-semibold" style={{color:'var(--gold)'}}>
                        ₹{Number(r.amount).toLocaleString('en-IN')}
                      </span>
                    ) : <span style={{color:'var(--text-muted)'}}>—</span>}
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="text-xs" style={{color:'var(--text-muted)'}}>
                    {new Date(r.created_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}
                  </td>
                  <td>
                    <Link href={`/requests/${r.id}`} className="btn-secondary text-xs px-3 py-2" style={{minHeight:36}}>
                      <Eye size={14} /> View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {requests.map(r => (
          <Link key={r.id} href={`/requests/${r.id}`} className="block glass-card rounded-xl p-4 hover:border-gold/30 transition-colors" style={{textDecoration:'none'}}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <span className="badge badge-gold">{r.department}</span>
              <StatusBadge status={r.status} />
            </div>
            <p className="text-sm font-medium mb-2 line-clamp-2" style={{color:'var(--text-primary)'}}>{r.purpose}</p>
            <div className="flex items-center justify-between">
              {r.amount
                ? <span className="font-bold text-sm" style={{color:'var(--gold)'}}>₹{Number(r.amount).toLocaleString('en-IN')}</span>
                : <span />
              }
              <span className="text-xs" style={{color:'var(--text-muted)'}}>
                {new Date(r.created_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
