import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Check, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  getRestaurantIdForUser,
  getSubscriptionStatus,
  isSubscriptionActive,
} from '@/lib/subscription'
import { PLANS } from '@/lib/stripe'
import { logout } from '../dashboard/actions'
import { UpgradeButton } from './upgrade-button'

const monthlyFeatures = [
  'Ubegrænsede bookinger',
  'Op til 50 borde',
  'Kalender og bordstyring',
  'Email-support',
]

const yearlyFeatures = [
  'Alt i månedlig',
  'Spar 44% vs. månedlig',
  'Prioriteret support',
  'Tidlig adgang til nye features',
]

export default async function UpgradePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const restaurantId = await getRestaurantIdForUser(user.id)
  const sub = restaurantId ? await getSubscriptionStatus(restaurantId) : null
  const active = isSubscriptionActive(sub)

  return (
    <div className="min-h-full flex-1 bg-[#f9fafb]">
      <header className="border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-logo text-2xl tracking-tight text-[#111827]">
            Napkind
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-sm font-medium text-[#111827] hover:border-[#111827] transition"
            >
              Log ud
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {active && (
          <Link
            href="/dashboard"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#111827] transition"
          >
            <ArrowLeft size={16} />
            Tilbage til dashboard
          </Link>
        )}

        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#fef3c7] px-3 py-1 text-xs font-semibold text-[#b45309]">
            <Sparkles size={14} />
            Napkind Premium
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
            Opgrader til Napkind Premium
          </h1>
          <p className="mt-3 text-sm text-[#6b7280]">
            Få adgang til alle features og administrer din restaurant uden begrænsninger.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PricingCard
            label="Månedlig"
            price="149 kr"
            period="/md"
            subtitle="Faktureres månedligt"
            features={monthlyFeatures}
            priceId={PLANS.monthly.priceId}
          />
          <PricingCard
            label="Årlig"
            price="999 kr"
            period="/år"
            subtitle="Svarende til 83 kr/md — spar 44%"
            features={yearlyFeatures}
            priceId={PLANS.yearly.priceId}
            highlighted
          />
        </div>

        <p className="mt-8 text-center text-xs text-[#6b7280]">
          Priser er ekskl. moms. Opsig når som helst.
        </p>
      </main>
    </div>
  )
}

function PricingCard({
  label,
  price,
  period,
  subtitle,
  features,
  priceId,
  highlighted = false,
}: {
  label: string
  price: string
  period: string
  subtitle: string
  features: string[]
  priceId: string
  highlighted?: boolean
}) {
  return (
    <div
      className={`relative rounded-xl border bg-white p-6 ${
        highlighted ? 'border-[#f59e0b] shadow-md' : 'border-[#e5e7eb]'
      }`}
    >
      {highlighted && (
        <div className="absolute -top-3 left-6 rounded-full bg-[#f59e0b] px-2.5 py-0.5 text-xs font-semibold text-white">
          Bedste værdi
        </div>
      )}

      <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6b7280]">
        {label}
      </h2>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight text-[#111827]">
          {price}
        </span>
        <span className="text-sm text-[#6b7280]">{period}</span>
      </div>
      <p className="mt-1 text-sm text-[#6b7280]">{subtitle}</p>

      <ul className="mt-5 space-y-2">
        {features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-sm text-[#111827]"
          >
            <Check size={16} className="mt-0.5 shrink-0 text-[#f59e0b]" />
            {f}
          </li>
        ))}
      </ul>

      <UpgradeButton priceId={priceId} />
    </div>
  )
}
