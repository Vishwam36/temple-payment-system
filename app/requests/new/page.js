'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DEPARTMENTS } from '@/lib/constants'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewRequestPage() {
  const router = useRouter()
  const [department, setDepartment] = useState('')
  const [purpose, setPurpose] = useState('')
  const [amount, setAmount] = useState('')
  const [senderAccount, setSenderAccount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department, purpose, amount: amount ? Number(amount) : null, sender_account: senderAccount || null }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to submit'); setLoading(false) }
    else { router.push(`/requests/${data.request.id}`) }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/requests" className="btn-secondary px-3 py-2" style={{minHeight:36}}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold gradient-text">New Payment Request</h1>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>Submit a payment for approval</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="form-label">Department *</label>
            <select id="dept-select" className="form-input" value={department} onChange={e => setDepartment(e.target.value)} required>
              <option value="">Select department…</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="form-label">Purpose / Description *</label>
            <textarea
              id="purpose-input"
              className="form-input"
              rows={4}
              placeholder="Describe the purpose of this payment request…"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              required
              style={{resize:'vertical',minHeight:100}}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Amount (₹)</label>
              <input
                id="amount-input"
                type="number"
                min="0"
                step="0.01"
                className="form-input"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Sender Account</label>
              <input
                id="sender-account-input"
                type="text"
                className="form-input"
                placeholder="Account / UPI"
                value={senderAccount}
                onChange={e => setSenderAccount(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg p-3 text-sm" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#FCA5A5'}}>{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <Link href="/requests" className="btn-secondary flex-1 justify-center">Cancel</Link>
            <button id="submit-request-btn" type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? <><span className="spinner" style={{width:16,height:16}} /> Submitting…</> : '🙏 Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
