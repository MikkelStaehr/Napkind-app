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
  'Unlimited bookings',
  'Up to 50 tables',
  'Calendar and table management',
  'Email support',
]

const yearlyFeatures = [
  'Everything in Monthly',
  'Save 44% vs. monthly',
  'Priority support',
  'Early access to new features',
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
              Log out
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
            Back to dashboard
          </Link>
        )}

        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#fef3c7] px-3 py-1 text-xs font-semibold text-[#b45309]">
            <Sparkles size={14} />
            Napkind Premium
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#111827] sm:text-4xl">
            Upgrade to Napkind Premium
          </h1>
          <p className="mt-3 text-sm text-[#6b7280]">
            Unlock every feature and manage your restaurant without limits.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PricingCard
            label="Monthly"
            price="149 kr"
            period="/mo"
            subtitle="Billed monthly"
            features={monthlyFeatures}
            priceId={PLANS.monthly.priceId}
          />
          <PricingCard
            label="Yearly"
            price="999 kr"
            period="/yr"
            subtitle="Equivalent to 83 kr/mo — save 44%"
            features={yearlyFeatures}
            priceId={PLANS.yearly.priceId}
            highlighted
          />
        </div>

        <p className="mt-8 text-center text-xs text-[#6b7280]">
          Prices exclude VAT. Cancel any time.
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
          Best value
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
