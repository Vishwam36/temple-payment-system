'use client'
import { useState, useMemo } from 'react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Eye, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { STATUS_LABELS } from '@/lib/constants'

export default function RequestTable({ requests }) {
  // ── FILTER & SORT STATES ──────────────────────────────────
  const [deptFilter, setDeptFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortOption, setSortOption] = useState('date_desc') // Default setup: Newest first

  // Dynamically compile menu option targets from the initial payload structure
  const uniqueDepartments = useMemo(() => {
    if (!requests) return []
    return [...new Set(requests.map(r => r.department))].filter(Boolean).sort()
  }, [requests])

  const uniqueStatuses = useMemo(() => {
    if (!requests) return []
    return [...new Set(requests.map(r => r.status))].filter(Boolean).sort()
  }, [requests])

  // ── RESET DATA ENGINE ROUTINE ─────────────────────────────
  const handleReset = () => {
    setDeptFilter('all')
    setStatusFilter('all')
    setSortOption('date_desc')
  }

  const isFilteredOrSorted = deptFilter !== 'all' || statusFilter !== 'all' || sortOption !== 'date_desc'

  // ── DATA COMPOSER ENGINE ──────────────────────────────────
  const processedRequests = useMemo(() => {
    if (!requests) return []

    let result = [...requests]

    // 1. Apply Department Filter Rules
    if (deptFilter !== 'all') {
      result = result.filter(r => r.department === deptFilter)
    }

    // 2. Apply Status Filter Rules
    if (statusFilter !== 'all') {
      result = result.filter(r => r.status === statusFilter)
    }

    // 3. Apply Multi-Axis Sorting Routine
    result.sort((a, b) => {
      switch (sortOption) {
        case 'date_desc': // Submitted: Newest First
          return new Date(b.created_at) - new Date(a.created_at)
        case 'date_asc': // Submitted: Oldest First
          return new Date(a.created_at) - new Date(b.created_at)
        case 'amount_desc': // Amount: High to Low
          return (Number(b.amount) || 0) - (Number(a.amount) || 0)
        case 'amount_asc': // Amount: Low to High
          return (Number(a.amount) || 0) - (Number(b.amount) || 0)
        default:
          return 0
      }
    })

    return result
  }, [requests, deptFilter, statusFilter, sortOption])

  // Initial Database Zero-Row Core Fallback
  if (!requests?.length) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <div className="text-4xl mb-3">📭</div>
        <p className="font-semibold" style={{ color: 'var(--text-secondary)' }}>No requests found</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Payment requests will appear here</p>
      </div>
    )
  }

  return (
    <>
      {/* ── FILTER / SORT MANAGEMENT BAR CONTROL PANEL ───────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-5 p-4 rounded-xl glass-card items-end">
        <div>
          <label className="form-label text-xs block mb-1">Filter by Department</label>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="w-full text-sm rounded-lg p-2 bg-black/20"
            style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-primary)', minHeight: 38 }}
          >
            <option value="all">📁 All Departments</option>
            {uniqueDepartments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label text-xs block mb-1">Filter by Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full text-sm rounded-lg p-2 bg-black/20"
            style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-primary)', minHeight: 38 }}
          >
            <option value="all">🚦 All Statuses</option>
            {uniqueStatuses.map(status => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label text-xs block mb-1">Sort Controls</label>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="w-full text-sm rounded-lg p-2 bg-black/20"
            style={{ border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-primary)', minHeight: 38 }}
          >
            <option value="date_desc">📅 Submitted: Newest First</option>
            <option value="date_asc">📅 Submitted: Oldest First</option>
            <option value="amount_desc">💰 Amount: High to Low</option>
            <option value="amount_asc">💰 Amount: Low to High</option>
          </select>
        </div>

        <div>
          <button
            onClick={handleReset}
            disabled={!isFilteredOrSorted}
            className="w-full text-sm font-medium px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-all"
            style={{
              background: isFilteredOrSorted ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${isFilteredOrSorted ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.05)'}`,
              color: isFilteredOrSorted ? '#FCA5A5' : 'var(--text-muted)',
              cursor: isFilteredOrSorted ? 'pointer' : 'not-allowed',
              minHeight: 38
            }}
          >
            <RotateCcw size={14} /> Clear Controls
          </button>
        </div>
      </div>

      {/* ── CONDITIONAL EMPTY RESULTS PANEL FOR ACTIVATED FILTERS ── */}
      {processedRequests.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center mb-4">
          <div className="text-3xl mb-2">🔍</div>
          <p className="font-semibold text-sm text-stone-300">No matches found</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}> Try adjustment profiles or click Clear Controls above.</p>
        </div>
      ) : (
        <>
          {/* ── DESKTOP RE-RENDER PLATFORM LEDGER ─────────────────── */}
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
                  {processedRequests.map(r => (
                    <tr key={r.id}>
                      <td><span className="badge badge-gold">{r.department}</span></td>
                      <td className="max-w-xs">
                        <span className="line-clamp-2 text-sm" style={{ color: 'var(--text-primary)' }}>{r.purpose}</span>
                      </td>
                      <td>
                        {r.amount ? (
                          <span className="font-semibold" style={{ color: 'var(--gold)' }}>
                            ₹{Number(r.amount).toLocaleString('en-IN')}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <Link href={`/requests/${r.id}`} className="btn-secondary text-xs px-3 py-2" style={{ minHeight: 36 }}>
                          <Eye size={14} /> View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── MOBILE CARD ARRAY PLATFORM VIEWPORT ──────────────── */}
          <div className="md:hidden space-y-3">
            {processedRequests.map(r => (
              <Link key={r.id} href={`/requests/${r.id}`} className="block glass-card rounded-xl p-4 hover:border-gold/30 transition-colors" style={{ textDecoration: 'none' }}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="badge badge-gold">{r.department}</span>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-sm font-medium mb-2 line-clamp-2" style={{ color: 'var(--text-primary)' }}>{r.purpose}</p>
                <div className="flex items-center justify-between">
                  {r.amount
                    ? <span className="font-bold text-sm" style={{ color: 'var(--gold)' }}>₹{Number(r.amount).toLocaleString('en-IN')}</span>
                    : <span />
                  }
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}