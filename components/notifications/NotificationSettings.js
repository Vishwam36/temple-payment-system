'use client'
import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { syncPush, enablePush, disablePush } from '@/lib/push/client'

// Keeps this browser's push subscription in step with the permission and the
// signed-in user: on load, when the tab becomes visible again, and when the
// browser reports a permission change. Never prompts.
export function usePushStatus(userId) {
  const [status, setStatus] = useState('loading')

  const refresh = useCallback(() => {
    if (!userId) return
    syncPush(userId).then(setStatus).catch(() => setStatus('error'))
  }, [userId])

  useEffect(() => {
    refresh()
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)

    let permissionStatus
    navigator.permissions?.query({ name: 'notifications' })
      .then(ps => { permissionStatus = ps; ps.onchange = refresh })
      .catch(() => { /* Permissions API unavailable: visibility re-check covers it */ })

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      if (permissionStatus) permissionStatus.onchange = null
    }
  }, [refresh])

  return [status, setStatus]
}

// Headless: mounted in the app shell so the subscription follows the user on every page.
export function PushSync({ userId }) {
  usePushStatus(userId)
  return null
}

const ENABLE_STEPS = [
  'Open this website in Chrome.',
  'Click the site information icon (the tune / padlock icon) to the left of the address bar.',
  'Open "Site settings".',
  'Find "Notifications".',
  'Change the setting from "Block" to "Allow".',
  'Return to this page and refresh it if notifications do not show as enabled.',
]

export default function NotificationSettings({ userId }) {
  const [status, setStatus] = usePushStatus(userId)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [helpOpen, setHelpOpen] = useState(false)

  async function run(action, successText) {
    setBusy(true)
    setMessage(null)
    try {
      const next = await action(userId)
      setStatus(next)
      if (next === 'enabled' && successText) setMessage({ type: 'success', text: successText })
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Something went wrong. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  if (status === 'loading') return null

  if (status === 'unsupported' || status === 'unconfigured') {
    return (
      <div className="glass-card rounded-xl p-4 mb-6 flex items-center gap-3">
        <BellOff size={16} style={{ color: 'var(--text-muted)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {status === 'unsupported'
            ? 'Browser notifications are not available here. Use an up-to-date Chrome on the secure (https) site.'
            : 'Browser notifications are not configured for this site yet.'}
        </span>
      </div>
    )
  }

  const blocked = status === 'blocked'
  const enabled = status === 'enabled'
  const Icon = enabled ? BellRing : blocked ? BellOff : Bell

  return (
    <div className="glass-card rounded-xl p-4 mb-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(245,166,35,0.1)' }}>
          <Icon size={16} style={{ color: blocked ? '#991B1B' : 'var(--gold)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Browser Notifications</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {enabled && 'You will be notified on this browser when your requests or approvals need attention.'}
            {blocked && 'Notifications are blocked for this site in your browser.'}
            {(status === 'prompt' || status === 'off' || status === 'error') && 'Get notified on this browser when your requests or approvals need attention.'}
          </div>
        </div>

        {enabled && (
          <div className="flex items-center gap-2">
            <span className="badge badge-emerald">Notifications Enabled</span>
            <button type="button" className="btn-secondary" style={{ minHeight: 36 }} disabled={busy} onClick={() => run(disablePush)}>
              Disable Notifications
            </button>
          </div>
        )}
        {blocked && (
          <div className="flex items-center gap-2">
            <span className="badge badge-red">Notifications Blocked</span>
            <button type="button" className="btn-secondary" style={{ minHeight: 36 }} onClick={() => setHelpOpen(true)}>
              How to Enable Notifications
            </button>
          </div>
        )}
        {(status === 'prompt' || status === 'off' || status === 'error') && (
          <button type="button" className="btn-primary" style={{ minHeight: 36 }} disabled={busy} onClick={() => run(enablePush, 'Notifications enabled for this browser.')}>
            <Bell size={14} /> {busy ? 'Enabling…' : 'Enable Notifications'}
          </button>
        )}
      </div>

      {message && <div className={`alert alert-${message.type} mt-3`}>{message.text}</div>}

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="How to Enable Notifications">
        <ol className="list-decimal pl-5 space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {ENABLE_STEPS.map(step => <li key={step}>{step}</li>)}
        </ol>
        <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          The application works normally with notifications blocked; you just won&apos;t receive browser alerts.
        </p>
      </Modal>
    </div>
  )
}
