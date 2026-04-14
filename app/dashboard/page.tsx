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
import { DashboardHeader } from './_components/dashboard-header'
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
    { label: 'Bookinger i dag', value: 0 },
    { label: 'Borde aktive', value: 0 },
    { label: 'Afventer', value: 0 },
  ]

  return (
    <div className="min-h-full flex-1 bg-white">
      <DashboardHeader restaurantName={restaurantName} />

      <main className="mx-auto max-w-5xl px-6 py-16">
        {upgraded === 'true' && <UpgradedBanner />}

        <section>
          <h1 className="font-logo text-5xl tracking-tight text-[#111827]">
            God dag, {restaurantName}
          </h1>
          <p className="mt-2 text-sm capitalize text-[#6b7280]">{today}</p>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="font-logo text-4xl text-[#111827]">{s.value}</div>
                <div className="mt-1 text-xs uppercase tracking-wide text-[#6b7280]">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Link
              href="/dashboard/floorplan"
              className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-6 py-3 text-sm font-medium text-white hover:bg-[#1f2937] transition"
            >
              <Monitor size={16} strokeWidth={1.5} />
              Åbn restaurantvisning
            </Link>
          </div>
        </section>

        <section className="mt-20 border-t border-[#f3f4f6] pt-10">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
            Administrer
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
            {sections.map((s) => {
              const Icon = s.icon
              return (
                <Link
                  key={s.href}
                  href={s.href}
                  className="group flex items-start gap-4 border-b border-[#f3f4f6] pb-6 hover:border-[#111827] transition"
                >
                  <Icon
                    size={28}
                    strokeWidth={1.25}
                    className="mt-1 shrink-0 text-[#111827]"
                  />
                  <div>
                    <h3 className="font-logo text-2xl tracking-tight text-[#111827] transition group-hover:underline">
                      {s.label}
                    </h3>
                    <p className="mt-1 text-sm text-[#6b7280]">{s.description}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
