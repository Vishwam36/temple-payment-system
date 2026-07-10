'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DEPARTMENTS } from '@/lib/constants'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewRequestPage() {
  const router = useRouter()
  const [department, setDepartment] = useState('')
  const [purpose, setPurpose] = useState('')
  const [amount, setAmount] = useState('')

  // ── DUAL-INPUT RECEIVER STATE ───────────────────────────────
  const [dbPresets, setDbPresets] = useState([]) // Dynamic storage from DB
  const [selectedPreset, setSelectedPreset] = useState('custom')
  const [customReceiver, setCustomReceiver] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── FETCH ACCOUNT PRESETS FROM DB ────────────────────────────
  useEffect(() => {
    async function fetchPresets() {
      try {
        const res = await fetch('/api/preset-accounts?type=receiver')
        const data = await res.json()

        if (res.ok) {
          // Fallback to empty array if record rows evaluate as null/undefined
          setDbPresets(data.presets || [])
        } else {
          console.error('Server execution error message:', data.error)
        }
      } catch (err) {
        console.error('Failed to pre-load receiver template states:', err)
      }
    }
    fetchPresets()
  }, [])

  // ── SMART FILTERING LOGIC ────────────────────────────────────
  // Filters presets to show matching department profiles OR global accounts (where department is null)
  const filteredPresets = useMemo(() => {
    return dbPresets.filter(preset => {
      if (!preset.department) return true // Global preset
      return preset.department === department // Department-specific match
    })
  }, [dbPresets, department])

  // Reset preset selection if the current preset disappears due to department changing
  useEffect(() => {
    if (selectedPreset !== 'custom') {
      const isStillAvailable = filteredPresets.some(p => p.account_string === selectedPreset)
      if (!isStillAvailable) {
        setSelectedPreset('custom')
        setCustomReceiver('')
      }
    }
  }, [department, filteredPresets, selectedPreset])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const finalReceiverAccount = selectedPreset === 'custom' ? customReceiver.trim() : selectedPreset

    if (!finalReceiverAccount) {
      setError('Receiver Account details cannot be empty.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department,
          purpose,
          amount: amount ? Number(amount) : null,
          receiver_account: finalReceiverAccount
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to submit request statement.')
        setLoading(false)
      } else {
        router.push(`/requests/${data.request.id}`)
      }
    } catch (err) {
      setError('A connection exception occurred while processing form submission.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/requests" className="btn-secondary px-3 py-2" style={{ minHeight: 36 }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold gradient-text">New Payment Request</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Submit a payment for approval</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Department Selection */}
          <div>
            <label className="form-label">Department *</label>
            <select id="dept-select" className="form-input" value={department} onChange={e => setDepartment(e.target.value)} required>
              <option value="">Select department…</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Purpose / Description */}
          <div>
            <label className="form-label">Purpose / Description *</label>
            <textarea
              id="purpose-input"
              className="form-input"
              rows={3}
              placeholder="Describe the purpose of this payment request…"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              required
              style={{ resize: 'vertical', minHeight: 80 }}
            />
          </div>

          {/* Amount Only */}
          <div>
            <label className="form-label">Amount (₹) *</label>
            <input
              id="amount-input"
              type="number"
              min="0"
              step="0.01"
              className="form-input"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </div>

          {/* ── DYNAMIC RECEIVER ACCOUNT CONTAINER ────────────────── */}
          <div className="p-4 rounded-xl space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <label className="form-label block text-xs font-semibold">
              Receiver Account / Destination Target *
            </label>

            {/* Interactive Dropdown Selector */}
            <select
              value={selectedPreset}
              onChange={(e) => {
                setSelectedPreset(e.target.value)
                if (e.target.value !== 'custom') setCustomReceiver('')
              }}
              className="w-full rounded-lg p-2.5 text-sm"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', minHeight: 38 }}
            >
              <option value="custom">✍️ Custom Account / Manual Multi-line Address Profile</option>
              {filteredPresets.map((preset) => (
                <option key={preset.id} value={preset.account_string}>
                  📁 {preset.label} {preset.department ? `(${preset.department})` : '(Global)'}
                </option>
              ))}
            </select>

            {/* Textarea Entry Canvas */}
            <div>
              <textarea
                id="receiver-account-input"
                className="w-full rounded-lg p-2.5 text-xs font-mono transition-all"
                rows={4}
                placeholder={`Bank Name:\nAccount Number:\nIFSC Code:\nBeneficiary Name:`}
                value={selectedPreset === 'custom' ? customReceiver : selectedPreset}
                onChange={(e) => setCustomReceiver(e.target.value)}
                disabled={selectedPreset !== 'custom'}
                required={selectedPreset === 'custom'}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  opacity: selectedPreset !== 'custom' ? 0.5 : 1,
                  resize: 'vertical',
                  whiteSpace: 'pre-wrap'
                }}
              />
              {selectedPreset !== 'custom' && (
                <p className="text-[10px] mt-1 italic" style={{ color: '#B45309' }}>
                  ⚡ Locked to chosen database preset profile. Switch selection context to manual mode to edit fields.
                </p>
              )}
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {/* Action Trigger Deck */}
          <div className="flex gap-3 pt-2">
            <Link href="/requests" className="btn-secondary flex-1 justify-center">Cancel</Link>
            <button id="submit-request-btn" type="submit" className="btn-primary flex-1" disabled={loading}>
              {loading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Submitting…</> : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}