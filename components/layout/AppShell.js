// components/ui/AppShell.js
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ROLES, ROLES_DB } from '@/lib/constants'
import { PushSync } from '@/components/notifications/NotificationSettings'
import { detachPushOnSignOut } from '@/lib/push/client'
import {
  LayoutDashboard, FileText, Inbox, ShieldCheck, LogOut, Menu, X
} from 'lucide-react'

// Updated helper handles scanning an array list of string role contexts
function navItems(userRoles) {
  const roles = userRoles.map(r => r.role)

  const items = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/requests', label: 'Requests', icon: FileText },
  ]

  // Same reviewer-role rule as the Dashboard's My Queue card
  if (roles.some(r => r !== ROLES_DB.applicant)) {
    items.push({ href: '/requests?status=my_queue', label: 'My Queue', icon: Inbox, isQueue: true })
  }

  if (roles.includes('super_admin')) {
    items.push({ href: '/admin', label: 'Admin', icon: ShieldCheck })
  }
  return items
}

export default function AppShell({ profile, userRoles = [], queueCount = 0, children }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const items = navItems(userRoles)

  // The requests list doubles as My Queue (status=my_queue), and a request opened from the
  // queue carries queue=1 — highlight My Queue rather than Requests in both cases.
  const inQueue = pathname.startsWith('/requests') &&
    (searchParams.get('status') === 'my_queue' || searchParams.get('queue') === '1' || pathname === '/requests/queue')

  // Extract unique active roles and specific tracking contexts 
  const uniqueRoles = Array.from(new Set(userRoles.map(r => r.role)))
  const managedDepts = userRoles
    .filter(r => r.role === 'department_com' && r.department)
    .map(r => r.department)

  async function handleLogout() {
    // Must run while still signed in: stops this browser getting the departing user's notifications.
    await detachPushOnSignOut()
    // Loaded on demand: the Supabase browser client is only needed here, so it stays out of
    // the bundle every app page downloads.
    const { createClient } = await import('@/lib/supabase/client')
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const Sidebar = ({ mobile = false }) => (
    <div className={mobile ? '' : 'sidebar'} style={mobile ? { display: 'flex', flexDirection: 'column', height: '100%' } : {}}>
      {/* Logo */}
      <div className="p-5 border-b" style={{ borderColor: 'rgba(245,166,35,0.1)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl saffron-glow flex-shrink-0" style={{ background: 'linear-gradient(135deg,#FF6B00,#F5A623)' }}>🛕</div>
          <div>
            <div className="font-bold text-sm gradient-text leading-tight">ISKCON Prayagraj</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Payment System</div>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map(({ href, label, icon: Icon, isQueue }) => {
          const active = isQueue
            ? inQueue
            : !(href === '/requests' && inQueue) && (pathname === href || pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setSidebarOpen(false)}
              className={`sidebar-link ${active ? 'active' : ''}`}
            >
              <Icon size={18} />
              {label}
              {isQueue && queueCount > 0 && (
                <span className="badge badge-purple ml-auto text-[10px] py-0.5 px-1.5" aria-label={`${queueCount} pending`}>
                  {queueCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* User Status Meta Cards */}
      <div className="p-3 border-t" style={{ borderColor: 'rgba(245,166,35,0.1)' }}>
        <div className="glass-card rounded-xl p-3 mb-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg,#FF6B00,#F5A623)', color: '#0F0A00' }}>
              {(profile?.full_name || profile?.email || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{profile?.full_name || 'User'}</div>
              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{profile?.email}</div>
            </div>
          </div>

          {/* Render individual identity badges for each profile permission level mapping */}
          <div className="flex flex-wrap gap-1 max-w-full">
            {uniqueRoles.length > 0 ? (
              uniqueRoles.map(role => (
                <span key={role} className="badge badge-gold text-[10px] py-0.5 px-1.5">
                  {ROLES[role] || role}
                </span>
              ))
            ) : (
              <span className="badge badge-gold text-[10px] py-0.5 px-1.5">Applicant</span>
            )}
          </div>

          {managedDepts.length > 0 && (
            <div className="text-[11px] mt-1.5 pt-1 truncate" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
              Managing: {managedDepts.join(', ')}
            </div>
          )}
        </div>

        <button id="logout-btn" onClick={handleLogout} className="sidebar-link w-full text-left" style={{ color: '#991B1B' }}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-dark)' }}>
      <PushSync userId={profile?.id} />
      {/* Desktop sidebar */}
      <div className="hidden lg:block" style={{ width: 240, flexShrink: 0 }}>
        <Sidebar />
      </div>

      {/* Mobile drawer overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 h-full" style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}>
            <button className="absolute top-4 right-4 p-1 rounded-lg" style={{ color: 'var(--text-muted)' }} onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </button>
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main content area wrapper */}
      <div className="flex-1 flex flex-col min-h-screen" style={{ maxWidth: '100%' }}>
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
          <button id="open-sidebar" onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg" style={{ color: 'var(--text-muted)', minHeight: 44, minWidth: 44 }}>
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg">🛕</span>
            <span className="font-bold text-sm gradient-text">Temple Payment</span>
          </div>
          <div className="ml-auto">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'linear-gradient(135deg,#FF6B00,#F5A623)', color: '#0F0A00' }}>
              {(profile?.full_name || profile?.email || '?')[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page children contents insertion points */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}