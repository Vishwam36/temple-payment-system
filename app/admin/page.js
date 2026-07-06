'use client'
import { useState, useEffect } from 'react'
import { DEPARTMENTS, ROLES } from '@/lib/constants'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { UserCheck, ShieldAlert } from 'lucide-react'

export default function AdminPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingUserId, setUpdatingUserId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Temporary local state for user updates while editing
  const [editedRoles, setEditedRoles] = useState({})
  const [editedDepts, setEditedDepts] = useState({})

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch users')
      setUsers(data.users || [])
      
      // Initialize edit states
      const initialRoles = {}
      const initialDepts = {}
      data.users?.forEach(u => {
        initialRoles[u.id] = u.role
        initialDepts[u.id] = u.department || ''
      })
      setEditedRoles(initialRoles)
      setEditedDepts(initialDepts)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdate(userId) {
    setUpdatingUserId(userId)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          role: editedRoles[userId],
          department: editedRoles[userId] === 'department_com' ? editedDepts[userId] : null
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update user')
      setSuccess('User updated successfully')
      
      // Update local users array
      setUsers(prev => prev.map(u => {
        if (u.id === userId) {
          const role = editedRoles[userId]
          return {
            ...u,
            role,
            department: role === 'department_com' ? editedDepts[userId] : null
          }
        }
        return u
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingUserId(null)
    }
  }

  if (loading) return <LoadingSpinner message="Fetching user directory..." />

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
          <ShieldAlert size={26} className="text-saffron" />
          Super Admin Console
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Map Gmail/email users to their system roles and departments.
        </p>
      </div>

      {error && (
        <div className="rounded-lg p-3 text-sm mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg p-3 text-sm mb-4" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#6EE7B7' }}>
          {success}
        </div>
      )}

      {/* Desktop view */}
      <div className="hidden md:block glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>User Details</th>
                <th>Role Assignment</th>
                <th>Department Scope</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const currentRole = editedRoles[u.id] || u.role
                const currentDept = editedDepts[u.id] || u.department || ''
                const isCom = currentRole === 'department_com'
                const isUpdating = updatingUserId === u.id
                const hasChanged = u.role !== currentRole || u.department !== (isCom ? currentDept : null)

                return (
                  <tr key={u.id}>
                    <td>
                      <div>
                        <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                          {u.full_name || 'No Name'}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {u.email}
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        id={`role-select-desktop-${u.id}`}
                        className="form-input text-xs"
                        style={{ minWidth: 160 }}
                        value={currentRole}
                        onChange={e => {
                          setEditedRoles(prev => ({ ...prev, [u.id]: e.target.value }))
                        }}
                      >
                        {Object.entries(ROLES).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {isCom ? (
                        <select
                          id={`dept-select-desktop-${u.id}`}
                          className="form-input text-xs"
                          style={{ minWidth: 160 }}
                          value={currentDept}
                          onChange={e => {
                            setEditedDepts(prev => ({ ...prev, [u.id]: e.target.value }))
                          }}
                        >
                          <option value="">Select department...</option>
                          {DEPARTMENTS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Global Scope</span>
                      )}
                    </td>
                    <td>
                      <button
                        id={`save-btn-desktop-${u.id}`}
                        onClick={() => handleUpdate(u.id)}
                        disabled={isUpdating || !hasChanged}
                        className="btn-primary text-xs"
                        style={{ minHeight: 40, padding: '0.25rem 1rem' }}
                      >
                        {isUpdating ? (
                          <span className="spinner" style={{ width: 14, height: 14 }} />
                        ) : (
                          <><UserCheck size={14} /> Update</>
                        )}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile list of cards */}
      <div className="md:hidden space-y-4">
        {users.map(u => {
          const currentRole = editedRoles[u.id] || u.role
          const currentDept = editedDepts[u.id] || u.department || ''
          const isCom = currentRole === 'department_com'
          const isUpdating = updatingUserId === u.id
          const hasChanged = u.role !== currentRole || u.department !== (isCom ? currentDept : null)

          return (
            <div key={u.id} className="glass-card rounded-xl p-4 space-y-3">
              <div>
                <div className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {u.full_name || 'No Name'}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {u.email}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">System Role</label>
                  <select
                    id={`role-select-mobile-${u.id}`}
                    className="form-input text-xs w-full"
                    value={currentRole}
                    onChange={e => {
                      setEditedRoles(prev => ({ ...prev, [u.id]: e.target.value }))
                    }}
                  >
                    {Object.entries(ROLES).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Department</label>
                  {isCom ? (
                    <select
                      id={`dept-select-mobile-${u.id}`}
                      className="form-input text-xs w-full"
                      value={currentDept}
                      onChange={e => {
                        setEditedDepts(prev => ({ ...prev, [u.id]: e.target.value }))
                      }}
                    >
                      <option value="">Select department...</option>
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="form-input text-xs bg-white/5 border-dashed flex items-center justify-center" style={{ minHeight: 44, color: 'var(--text-muted)' }}>
                      Global
                    </div>
                  )}
                </div>
              </div>

              <button
                id={`save-btn-mobile-${u.id}`}
                onClick={() => handleUpdate(u.id)}
                disabled={isUpdating || !hasChanged}
                className="btn-primary w-full text-xs"
                style={{ minHeight: 44 }}
              >
                {isUpdating ? (
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                ) : (
                  <><UserCheck size={14} /> Save Assignment</>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
