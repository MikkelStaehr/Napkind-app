import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_ONLY_COOKIE, stripPersistenceIfSessionOnly } from '@/lib/supabase/session-flag'
import {
  getRestaurantIdForUser,
  getSubscriptionStatus,
  isSubscriptionActive,
} from '@/lib/subscription'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const sessionOnly = request.cookies.get(SESSION_ONLY_COOKIE)?.value === '1'

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          const adjusted = stripPersistenceIfSessionOnly(cookiesToSet, sessionOnly)
          adjusted.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          adjusted.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isDashboard = pathname.startsWith('/dashboard')
  const isSettings = pathname === '/dashboard/settings' || pathname.startsWith('/dashboard/settings/')

  if (!user && isDashboard) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isDashboard && !isSettings) {
    const restaurantId = await getRestaurantIdForUser(user.id)
    if (restaurantId) {
      const sub = await getSubscriptionStatus(restaurantId)
      if (!isSubscriptionActive(sub)) {
        return NextResponse.redirect(new URL('/upgrade', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
