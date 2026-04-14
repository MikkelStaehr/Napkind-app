import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { logout } from './actions'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: link } = await supabase
    .from('restaurant_users')
    .select('restaurant_id, restaurants(name)')
    .eq('user_id', user.id)
    .maybeSingle()

  const restaurantName =
    (link?.restaurants as { name?: string } | null)?.name ?? 'Din restaurant'

  const sections = [
    { href: '/dashboard/calendar', icon: '📅', label: 'Kalender' },
    { href: '/dashboard/bookings', icon: '📋', label: 'Bookinger' },
    { href: '/dashboard/tables', icon: '🪑', label: 'Borde' },
    { href: '/dashboard/settings', icon: '⚙️', label: 'Indstillinger' },
  ]

  return (
    <main className="flex-1 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold tracking-tight text-neutral-900">
            Napkind
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Log ud
            </button>
          </form>
        </header>

        <section className="mt-10">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Velkommen til Napkind
          </h1>
          <p className="mt-2 text-neutral-600">{restaurantName}</p>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group rounded-xl border border-neutral-200 bg-white p-6 transition hover:border-neutral-900 hover:shadow-sm"
            >
              <div className="text-3xl">{s.icon}</div>
              <div className="mt-3 text-sm font-medium text-neutral-900 group-hover:underline">
                {s.label}
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  )
}
