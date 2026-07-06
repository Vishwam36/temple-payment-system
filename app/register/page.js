'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleRegister(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (err) {
      setError(err.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{background:'radial-gradient(ellipse at top, #1A0F00 0%, #0F0A00 60%)'}}>
        <div className="glass-card rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-xl font-bold mb-2 gradient-text">Check your email</h2>
          <p className="text-sm mb-6" style={{color:'var(--text-muted)'}}>
            We&apos;ve sent a confirmation link to <strong style={{color:'var(--gold)'}}>{email}</strong>. Click it to activate your account.
          </p>
          <Link href="/login" className="btn-primary w-full">Back to Sign In</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:'radial-gradient(ellipse at top, #1A0F00 0%, #0F0A00 60%)'}}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{background:'radial-gradient(circle, #FF6B00, transparent)'}} />

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 saffron-glow" style={{background:'linear-gradient(135deg,#FF6B00,#F5A623)'}}>
            <span className="text-3xl">🛕</span>
          </div>
          <h1 className="text-2xl font-bold gradient-text">Create Account</h1>
          <p className="text-sm mt-1" style={{color:'var(--text-muted)'}}>Join the Temple Payment System</p>
        </div>

        <div className="glass-card rounded-2xl p-6">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="form-label">Full Name</label>
              <input id="reg-name" type="text" className="form-input" placeholder="Hari Das" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Email Address</label>
              <input id="reg-email" type="email" className="form-input" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Password</label>
              <input id="reg-password" type="password" className="form-input" placeholder="Min 8 characters" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div>
              <label className="form-label">Confirm Password</label>
              <input id="reg-confirm" type="password" className="form-input" placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>

            {error && (
              <div className="rounded-lg p-3 text-sm" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#FCA5A5'}}>
                {error}
              </div>
            )}

            <button id="reg-submit" type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <><span className="spinner" style={{width:16,height:16}} /> Creating account…</> : 'Create Account'}
            </button>
          </form>

          <div className="mt-5 text-center text-sm" style={{color:'var(--text-muted)'}}>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold hover:underline" style={{color:'var(--gold)'}}>Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
