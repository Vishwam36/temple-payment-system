'use client'
import { useState, useEffect } from 'react'
import { DEPARTMENTS, ROLES } from '@/lib/constants'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ShieldAlert, Trash2, UserPlus, ShieldCheck } from 'lucide-react'

export default function AdminPage() {
  const [assignments, setAssignments] = useState([]) // Master list of active role rows
  const [allUsers, setAllUsers] = useState([])       // For the user picker dropdown
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form State for creating a new assignment mapping
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState('applicant')
  const [selectedDept, setSelectedDept] = useState('')

  useEffect(() => {
    fetchAdminData()
  }, [])

  async function fetchAdminData() {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch directory maps')

      setAssignments(data.assignments || [])
      setAllUsers(data.users || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateAssignment(e) {
    e.preventDefault()
    if (!selectedUserId) return setError('Please select a target user.')
    if (selectedRole === 'department_com' && !selectedDept) {
      return setError('Department COMs must be assigned a valid department scope.')
    }

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST', // Switched to POST to safely append mappings
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserId,
          role: selectedRole,
          department: selectedRole === 'department_com' ? selectedDept : null
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to assign role mapping')

      setSuccess('New role assignment successfully mapped!')
      // Reset form variables
      setSelectedDept('')

      // Refresh local component states
      await fetchAdminData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteAssignment(assignmentId) {
    if (!confirm('Are you sure you want to strip this role assignment from the user?')) return

    setDeletingId(assignmentId)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/admin/users?id=${assignmentId}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to revoke role')

      setSuccess('Role mapping revoked successfully.')
      setAssignments(prev => prev.filter(item => item.id !== assignmentId))
    } catch (err) {
      setError(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) return <LoadingSpinner message="Loading Master Authorization Matrix..." />

  return (
    <div className="max-w-5xl mx-auto pb-12 px-4 md:px-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
          <ShieldAlert size={26} className="text-saffron" />
          Super Admin Console
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Directly map systems roles and department scopes down to specific active users.
        </p>
      </div>

      {error && (
        <div className="rounded-lg p-3 text-sm mb-4 border" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg p-3 text-sm mb-4 border" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', color: '#6EE7B7' }}>
          {success}
        </div>
      )}

      {/* SECTION 1: ASSIGN NEW ROLE COMPONENT MAPPER */}
      <div className="glass-card rounded-xl p-5 mb-8 border border-white/10">
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <ShieldCheck size={16} className="text-emerald" /> Assign New System Matrix Record
        </h2>

        <form onSubmit={handleCreateAssignment} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="form-label text-xs font-bold mb-1 block">Select Target User</label>
            <select
              className="form-input text-xs w-full"
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              required
            >
              <option value="">Choose profile...</option>
              {allUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.full_name || 'No Name'} ({user.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label text-xs font-bold mb-1 block">System Role To Grant</label>
            <select
              className="form-input text-xs w-full"
              value={selectedRole}
              onChange={e => {
                setSelectedRole(e.target.value)
                if (e.target.value !== 'department_com') setSelectedDept('')
              }}
            >
              {Object.entries(ROLES).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label text-xs font-bold mb-1 block">Department Scope</label>
            <select
              className="form-input text-xs w-full disabled:opacity-40 disabled:cursor-not-allowed"
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              disabled={selectedRole !== 'department_com'}
              required={selectedRole === 'department_com'}
            >
              <option value="">Global / No Scope</option>
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary text-xs w-full flex items-center justify-center gap-2"
            style={{ minHeight: 42 }}
          >
            {submitting ? (
              <span className="spinner" style={{ width: 14, height: 14 }} />
            ) : (
              <><UserPlus size={14} /> Map Role Rule</>
            )}
          </button>
        </form>
      </div>

      {/* SECTION 2: THE MATRIX AUTHORIZATION TABLE */}
      <h2 className="text-md font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
        Active System Role Map Ledger ({assignments.length})
      </h2>

      {/* Desktop view */}
      <div className="hidden md:block glass-card rounded-xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Assigned Identity</th>
                <th>Granted Authority</th>
                <th>Department Scope Boundary</th>
                <th className="text-right">Revocation</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-8 text-sm text-muted">
                    No custom user roles currently deployed to the database.
                  </td>
                </tr>
              ) : (
                assignments.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div>
                        <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                          {item.profiles?.full_name || 'No Name'}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {item.profiles?.email}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="px-2 py-1 rounded text-xs font-mono uppercase bg-white/5 border border-white/10">
                        {ROLES[item.role] || item.role}
                      </span>
                    </td>
                    <td>
                      {item.department ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-saffron/10 border border-saffron/20 text-saffron">
                          {item.department}
                        </span>
                      ) : (
                        <span className="text-xs opacity-50 font-style: italic" style={{ color: 'var(--text-muted)' }}>Global Scope</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleDeleteAssignment(item.id)}
                        disabled={deletingId === item.id}
                        className="p-2 text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
                        title="Revoke Assignment"
                      >
                        {deletingId === item.id ? (
                          <span className="spinner" style={{ width: 14, height: 14 }} />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile view cards */}
      <div className="md:hidden space-y-4">
        {assignments.length === 0 ? (
          <div className="text-center p-8 glass-card text-xs text-muted">
            No dynamic authorization maps currently provisioned.
          </div>
        ) : (
          assignments.map(item => (
            <div key={item.id} className="glass-card rounded-xl p-4 flex flex-col space-y-3 border border-white/5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {item.profiles?.full_name || 'No Name'}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {item.profiles?.email}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteAssignment(item.id)}
                  disabled={deletingId === item.id}
                  className="p-2 text-red-400"
                >
                  {deletingId === item.id ? (
                    <span className="spinner" style={{ width: 14, height: 14 }} />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>

              <div className="flex gap-2 items-center text-xs">
                <span className="font-mono bg-white/5 px-2 py-1 rounded">
                  {ROLES[item.role] || item.role}
                </span>
                {item.department ? (
                  <span className="px-2 py-0.5 rounded bg-saffron/10 text-s saffron border border-saffron/20">
                    {item.department}
                  </span>
                ) : (
                  <span className="opacity-40 italic">Global Scope</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}