'use client'

// Browser-side Web Push helpers: service worker registration, subscribe/unsubscribe,
// and keeping the server's record bound to the signed-in user. Permission is only
// ever *requested* from enablePush(), which must be called from a user click.
import { apiFetch } from '@/lib/apiClient'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const SW_URL = '/sw.js'

// Per-user, per-browser opt-out: "Disable Notifications" must stick even though the
// browser permission itself stays "granted".
const optOutKey = (userId) => `push-opt-out:${userId}`
const isOptedOut = (userId) => { try { return localStorage.getItem(optOutKey(userId)) === '1' } catch { return false } }
const setOptedOut = (userId, value) => {
  try { value ? localStorage.setItem(optOutKey(userId), '1') : localStorage.removeItem(optOutKey(userId)) } catch { /* storage unavailable */ }
}

// Browser capability only. Needs a secure context: https, or http://localhost —
// opening the dev server via a LAN IP over plain http does not qualify.
function browserSupportsPush() {
  return typeof window !== 'undefined' && window.isSecureContext &&
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function isPushSupported() {
  return browserSupportsPush() && Boolean(VAPID_PUBLIC_KEY)
}

export const getPermission = () => {
  if (!browserSupportsPush()) return 'unsupported'
  if (!VAPID_PUBLIC_KEY) {
    console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set; browser notifications are disabled.')
    return 'unconfigured'
  }
  return Notification.permission
}

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
}

const keyMatches = (sub) => {
  const current = sub.options?.applicationServerKey
  if (!current) return true // not exposed by this browser; assume fine
  const a = new Uint8Array(current), b = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  return a.length === b.length && a.every((v, i) => v === b[i])
}

async function getRegistration() {
  await navigator.serviceWorker.register(SW_URL, { scope: '/' })
  return navigator.serviceWorker.ready
}

async function getOrCreateSubscription() {
  const reg = await getRegistration()
  let sub = await reg.pushManager.getSubscription()
  if (sub && !keyMatches(sub)) { // VAPID keys were rotated: the old subscription can't receive
    await sub.unsubscribe().catch(() => {})
    sub = null
  }
  return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })
}

async function saveSubscription(sub) {
  const res = await apiFetch('/api/push/subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save notification settings.')
}

// Avoid re-POSTing the same endpoint for the same user on every render/tab focus.
let lastSynced = null
let inFlight = null

// Brings the server in line with this browser, without ever prompting:
// permission granted + not opted out → ensure a subscription exists and is saved
// under *this* user (re-binds it after an account switch on a shared browser).
// Returns 'enabled' | 'off' | 'blocked' | 'prompt' | 'unsupported'.
export async function syncPush(userId) {
  const permission = getPermission()
  if (permission === 'unsupported' || permission === 'unconfigured') return permission
  if (permission === 'denied') return 'blocked'
  if (permission === 'default') return 'prompt'
  if (isOptedOut(userId)) return 'off'

  if (!inFlight) {
    inFlight = (async () => {
      const sub = await getOrCreateSubscription()
      const marker = `${userId}|${sub.endpoint}`
      if (lastSynced !== marker) {
        await saveSubscription(sub)
        lastSynced = marker
      }
      return 'enabled'
    })().finally(() => { inFlight = null })
  }
  return inFlight
}

// User clicked "Enable Notifications". The only place permission is requested.
export async function enablePush(userId) {
  if (!isPushSupported()) return getPermission()
  let permission = Notification.permission
  if (permission === 'default') permission = await Notification.requestPermission()
  if (permission === 'denied') return 'blocked'
  if (permission !== 'granted') return 'prompt' // dismissed the prompt
  setOptedOut(userId, false)
  lastSynced = null
  return syncPush(userId)
}

async function currentSubscription() {
  if (!isPushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration('/')
  return reg ? reg.pushManager.getSubscription() : null
}

async function deleteServerSubscription(endpoint, { keepalive = false } = {}) {
  await fetch('/api/push/subscription', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
    keepalive,
  })
}

// User clicked "Disable Notifications": remove server record, unsubscribe the browser.
export async function disablePush(userId) {
  setOptedOut(userId, true)
  lastSynced = null
  const sub = await currentSubscription()
  if (sub) {
    await deleteServerSubscription(sub.endpoint)
    await sub.unsubscribe().catch(() => {})
  }
  return 'off'
}

// Sign-out: stop this browser receiving the departing user's notifications. The browser
// subscription itself is kept, so the next user to sign in here is re-bound by syncPush.
export async function detachPushOnSignOut() {
  try {
    lastSynced = null
    const sub = await currentSubscription()
    if (sub) await deleteServerSubscription(sub.endpoint, { keepalive: true })
  } catch { /* never block sign-out */ }
}
