'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleReset(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false) }
    else { router.push('/dashboard') }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'radial-gradient(ellipse at top, #1A0F00 0%, #0F0A00 60%)'}}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 saffron-glow" style={{background:'linear-gradient(135deg,#FF6B00,#F5A623)'}}>
            <span className="text-3xl">🛕</span>
          </div>
          <h1 className="text-2xl font-bold gradient-text">Set New Password</h1>
        </div>
        <div className="glass-card rounded-2xl p-6">
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="form-label">New Password</label>
              <input id="reset-password" type="password" className="form-input" placeholder="Min 8 characters" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Confirm New Password</label>
              <input id="reset-confirm" type="password" className="form-input" placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>
            {error && <div className="rounded-lg p-3 text-sm" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#FCA5A5'}}>{error}</div>}
            <button id="reset-submit" type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <><span className="spinner" style={{width:16,height:16}} /> Saving…</> : 'Set New Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
