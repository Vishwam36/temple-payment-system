/* Service worker for Web Push notifications only.
 * Deliberately has no fetch handler / caching, so page loading behaves exactly as
 * without it. Payloads come from lib/push/messages.js: { title, body, url, tag }. */

const DEFAULT_PATH = '/dashboard'
// Same allow-list as safeAppPath() in lib/push/validation.js.
const SAFE_PATH = /^\/(dashboard|requests)(\/[A-Za-z0-9_-]+)*\/?$/
const ICON = '/icons/notification-icon.png'
const BADGE = '/icons/notification-badge.png'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// Resolves any candidate to an absolute same-origin URL on an allow-listed path,
// so a payload (or anything else) can never make a click open a foreign site.
function safeUrl(candidate) {
  let path = DEFAULT_PATH
  try {
    const url = new URL(candidate, self.location.origin)
    if (url.origin === self.location.origin && SAFE_PATH.test(url.pathname)) path = url.pathname
  } catch (e) { /* fall back to the dashboard */ }
  return new URL(path, self.location.origin).href
}

const str = (v, max) => (typeof v === 'string' && v ? v.slice(0, max) : null)

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }

  const tag = str(data.tag, 100)
  const eventId = str(data.eventId, 64)
  const options = {
    body: str(data.body, 400) || 'There is an update on a payment request.',
    icon: ICON,
    badge: BADGE,
    data: { url: safeUrl(data.url), eventId },
  }

  event.waitUntil((async () => {
    if (tag) {
      // A newer update about the same request replaces the older one instead of stacking.
      // If the server re-sent an event already on screen (a retry after an uncertain
      // failure), replace it silently rather than alerting the user a second time.
      // (Chrome requires every push to show a notification, so it cannot simply be dropped.)
      const shown = await self.registration.getNotifications({ tag }).catch(() => [])
      const isRepeat = Boolean(eventId) && shown.some((n) => n.data && n.data.eventId === eventId)
      options.tag = tag
      options.renotify = !isRepeat
      options.silent = isRepeat
    }
    await self.registration.showNotification(str(data.title, 120) || 'ISKCON Prayagraj Payments', options)
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = safeUrl(event.notification.data && event.notification.data.url)

  // Focus a tab already on the page, else reuse an open app tab, else open a new one.
  // Login and request-level authorisation are enforced by the app when the page loads.
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const appWindows = windows.filter((c) => new URL(c.url).origin === self.location.origin)

    const exact = appWindows.find((c) => c.url === target)
    if (exact) return exact.focus()

    for (const client of appWindows) {
      try {
        const navigated = await client.navigate(target)
        if (navigated) return navigated.focus()
      } catch (e) { /* uncontrolled tab: cannot navigate it, try the next / open new */ }
    }
    return self.clients.openWindow(target)
  })())
})

// The browser rotated the subscription: re-subscribe and re-register it with the
// server under the signed-in user (cookies go with same-origin fetches).
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const old = event.oldSubscription
    const key = old && old.options && old.options.applicationServerKey
    const sub = event.newSubscription ||
      (key ? await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }) : null)
    if (!sub) return
    await fetch('/api/push/subscription', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), oldEndpoint: old ? old.endpoint : undefined }),
    })
  })().catch(() => {}))
})
