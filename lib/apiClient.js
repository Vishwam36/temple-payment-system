'use client'

// Thin wrapper around fetch for same-origin API routes. An expired/missing
// session surfaces two different ways: our route handlers return 401 JSON,
// but the proxy middleware intercepts the request first and 307s straight to
// /login — which fetch's default redirect-following turns into a 200 HTML
// response for the login page instead of the JSON the caller expects. Both
// cases mean "not authenticated", so both are handled here instead of
// leaving every caller to fail confusingly on `res.json()`.
export async function apiFetch(input, init) {
  const res = await fetch(input, init)
  const wasBouncedToLogin = res.redirected && res.url.includes('/login')
  if (res.status === 401 || wasBouncedToLogin) {
    window.location.href = '/login'
    // Navigation is async; stop the caller from acting on a stale/unauthorized response.
    throw new Error('Session expired. Redirecting to login…')
  }
  return res
}
