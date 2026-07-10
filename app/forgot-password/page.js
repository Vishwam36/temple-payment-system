'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleReset(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (err) { setError(err.message); setLoading(false) }
    else { setSent(true); setLoading(false) }
  }

  if (sent) {
    return (
      <div className="auth-page-bg min-h-screen flex items-center justify-center p-4">
        <div className="glass-card rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">✉️</div>
          <h2 className="text-xl font-bold mb-2 gradient-text">Recovery email sent</h2>
          <p className="text-sm mb-6" style={{color:'var(--text-muted)'}}>
            Check <strong style={{color:'var(--gold)'}}>{email}</strong> for a password reset link.
          </p>
          <Link href="/login" className="btn-primary w-full">Back to Sign In</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 saffron-glow" style={{background:'linear-gradient(135deg,#FF6B00,#F5A623)'}}>
            <span className="text-3xl">🛕</span>
          </div>
          <h1 className="text-2xl font-bold gradient-text">Forgot Password</h1>
          <p className="text-sm mt-1" style={{color:'var(--text-muted)'}}>Enter your email to receive a reset link</p>
        </div>
        <div className="glass-card rounded-2xl p-6">
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="form-label">Email Address</label>
              <input id="forgot-email" type="email" className="form-input" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <button id="forgot-submit" type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <><span className="spinner" style={{width:16,height:16}} /> Sending…</> : 'Send Reset Link'}
            </button>
          </form>
          <div className="mt-5 text-center text-sm" style={{color:'var(--text-muted)'}}>
            <Link href="/login" className="font-semibold hover:underline" style={{color:'var(--gold)'}}>← Back to Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
