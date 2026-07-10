'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)

  // The reset-link redirect carries a one-time PKCE `code` — it must be
  // exchanged for a real session before updateUser() can change the password.
  useEffect(() => {
    async function establishRecoverySession() {
      const code = new URLSearchParams(window.location.search).get('code')

      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeErr) {
          setError('This password reset link is invalid or has expired. Please request a new one.')
          setVerifying(false)
          return
        }
        router.replace('/reset-password') // drop the one-time code from the URL
      }

      const { data: { session } } = await supabase.auth.getSession()
      setSessionReady(!!session)
      if (!session) setError('This password reset link is invalid or has expired. Please request a new one.')
      setVerifying(false)
    }
    establishRecoverySession()
  }, [])

  async function handleReset(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false) }
    else { router.push('/dashboard') }
  }

  return (
    <div className="auth-page-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 saffron-glow" style={{ background: 'linear-gradient(135deg,#FF6B00,#F5A623)' }}>
            <span className="text-3xl">🛕</span>
          </div>
          <h1 className="text-2xl font-bold gradient-text">Set New Password</h1>
        </div>
        <div className="glass-card rounded-2xl p-6">
          {verifying ? (
            <LoadingSpinner message="Verifying reset link…" />
          ) : sessionReady ? (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="form-label">New Password</label>
                <input id="reset-password" type="password" className="form-input" placeholder="Min 8 characters" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <div>
                <label className="form-label">Confirm New Password</label>
                <input id="reset-confirm" type="password" className="form-input" placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
              </div>
              {error && <div className="alert alert-error">{error}</div>}
              <button id="reset-submit" type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Saving…</> : 'Set New Password'}
              </button>
            </form>
          ) : (
            <div className="alert alert-error">{error}</div>
          )}
        </div>
      </div>
    </div>
  )
}
