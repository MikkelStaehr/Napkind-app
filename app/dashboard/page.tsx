import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  CalendarDays,
  ClipboardList,
  LayoutGrid,
  Monitor,
  Settings,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { logout } from './actions'
import { UpgradedBanner } from './upgraded-banner'

const sections = [
  {
    href: '/dashboard/calendar',
    icon: CalendarDays,
    label: 'Kalender',
    description:
      'Se bookinger dag for dag, uge og måned. Opret og administrer reservationer.',
  },
  {
    href: '/dashboard/bookings',
    icon: ClipboardList,
    label: 'Bookinger',
    description:
      'Oversigt over alle reservationer. Bekræft, annuller eller opret nye bookinger.',
  },
  {
    href: '/dashboard/tables',
    icon: LayoutGrid,
    label: 'Borde',
    description:
      'Opsæt din plantegning, administrer borde og se restaurantens layout.',
  },
  {
    href: '/dashboard/settings',
    icon: Settings,
    label: 'Indstillinger',
    description: 'Restaurantoplysninger, abonnement og kontoadministration.',
  },
]

function formatDanishDate(date: Date): string {
  return new Intl.DateTimeFormat('da-DK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>
}) {
  const { upgraded } = await searchParams
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

  const today = formatDanishDate(new Date())

  const stats = [
    { label: 'bookinger i dag', value: 0 },
    { label: 'borde aktive', value: 0 },
    { label: 'afventer', value: 0 },
  ]

  return (
    <div className="min-h-full flex-1 bg-[#f9fafb]">
      <header className="border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="font-logo text-2xl tracking-tight text-[#111827]">
            Napkind
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-[#6b7280] sm:inline">
              {restaurantName}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-sm font-medium text-[#111827] hover:border-[#111827] transition"
              >
                Log ud
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {upgraded === 'true' && <UpgradedBanner />}

        <section>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            God dag, {restaurantName}
          </h1>
          <p className="mt-1 text-sm capitalize text-[#6b7280]">{today}</p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-[#e5e7eb] bg-white px-4 py-3"
              >
                <div className="text-2xl font-bold text-[#111827]">{s.value}</div>
                <div className="text-sm text-[#6b7280]">{s.label}</div>
              </div>
            ))}
          </div>

          <Link
            href="/dashboard/floorplan"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#f59e0b] px-6 py-4 text-base font-semibold text-white shadow-sm hover:bg-[#d97706] transition sm:w-auto"
          >
            <Monitor size={18} />
            Åbn restaurantvisning
          </Link>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {sections.map((s) => {
            const Icon = s.icon
            return (
              <Link
                key={s.href}
                href={s.href}
                className="group rounded-xl border border-[#e5e7eb] bg-white p-6 transition hover:border-[#f59e0b] hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fef3c7] text-[#f59e0b]">
                  <Icon size={24} strokeWidth={2} />
                </div>
                <h2 className="mt-4 text-base font-semibold text-[#111827]">
                  {s.label}
                </h2>
                <p className="mt-1 text-sm text-[#6b7280]">{s.description}</p>
              </Link>
            )
          })}
        </section>
      </main>
    </div>
  )
}
