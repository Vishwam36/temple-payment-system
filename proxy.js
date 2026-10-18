import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { safeAppPath } from '@/lib/push/validation'

// Routes that authenticate themselves instead of via the session cookie.
// /api/push/dispatch (manual recovery) is protected by a bearer secret.
const SELF_AUTHENTICATED_ROUTES = ['/api/push/dispatch']

export async function proxy(request) {
  if (SELF_AUTHENTICATED_ROUTES.includes(request.nextUrl.pathname)) return NextResponse.next()

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const authRoutes = ['/login', '/register', '/forgot-password']
  const isAuthRoute = authRoutes.some(r => pathname.startsWith(r))

  // The recovery link from a password-reset email lands here carrying a one-time
  // code. Exchanging it establishes a real session, so this route must stay
  // reachable both while logged out (pre-exchange) and immediately after
  // (post-exchange) — unlike the other auth routes it never redirects either way.
  const isPasswordRecoveryRoute = pathname.startsWith('/reset-password')

  if (!user && !isAuthRoute && !isPasswordRecoveryRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    // Send the user back where they were going (e.g. a request opened from a push
    // notification) after signing in. Only allow-listed in-app paths are carried.
    const next = safeAppPath(pathname, null)
    if (next && next !== '/dashboard') url.searchParams.set('next', next)
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
