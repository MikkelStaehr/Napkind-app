import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SESSION_ONLY_COOKIE, stripPersistenceIfSessionOnly } from './session-flag'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            const sessionOnly = cookieStore.get(SESSION_ONLY_COOKIE)?.value === '1'
            const adjusted = stripPersistenceIfSessionOnly(cookiesToSet, sessionOnly)
            adjusted.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
