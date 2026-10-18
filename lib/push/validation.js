// Input validation for push subscriptions and redirect targets. Pure — unit-tested.

// The server POSTs to whatever endpoint a subscription names, so only real browser
// push services are accepted (prevents using the app as an SSRF relay).
const PUSH_SERVICE_HOSTS = [
  /^fcm\.googleapis\.com$/,               // Chrome, Edge (Chromium), Opera, Brave, Android
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^[a-z0-9-]+\.notify\.windows\.com$/,   // Legacy Edge / Windows WNS
  /^web\.push\.apple\.com$/,              // Safari 16+
]

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/

export function validateSubscription(sub) {
  if (!sub || typeof sub !== 'object') return { error: 'A push subscription is required.' }
  const { endpoint, keys } = sub

  if (typeof endpoint !== 'string' || endpoint.length > 2048) return { error: 'Invalid subscription endpoint.' }
  let url
  try { url = new URL(endpoint) } catch { return { error: 'Invalid subscription endpoint.' } }
  if (url.protocol !== 'https:' || !PUSH_SERVICE_HOSTS.some(re => re.test(url.hostname))) {
    return { error: 'Unsupported push service.' }
  }

  const p256dh = keys?.p256dh
  const auth = keys?.auth
  if (typeof p256dh !== 'string' || p256dh.length < 40 || p256dh.length > 200 || !BASE64URL.test(p256dh)) {
    return { error: 'Invalid subscription key.' }
  }
  if (typeof auth !== 'string' || auth.length < 16 || auth.length > 100 || !BASE64URL.test(auth)) {
    return { error: 'Invalid subscription key.' }
  }

  return { value: { endpoint, p256dh, auth } }
}

// Post-login / notification-click destinations: same-origin app paths only.
// Rejects absolute URLs, protocol-relative ("//evil.com") and backslash tricks.
const SAFE_PATH = /^\/(dashboard|requests)(\/[A-Za-z0-9_-]+)*\/?$/

export function safeAppPath(path, fallback = '/dashboard') {
  return typeof path === 'string' && SAFE_PATH.test(path) ? path : fallback
}
