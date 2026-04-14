import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { logout } from '../actions'
import { SettingsClient } from './settings-client'

type RestaurantRow = {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  subscription_status: string | null
  subscription_tier: string | null
  current_period_ends_at: string | null
  stripe_customer_id: string | null
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: link } = await supabase
    .from('restaurant_users')
    .select('restaurant_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!link?.restaurant_id) {
    redirect('/dashboard')
  }

  const { data: restaurant, error: restaurantError } = await supabaseAdmin
    .from('restaurants')
    .select(
      'id, name, address, phone, email, subscription_status, subscription_tier, current_period_ends_at, stripe_customer_id'
    )
    .eq('id', link.restaurant_id)
    .maybeSingle<RestaurantRow>()

  if (restaurantError) {
    throw new Error(
      'Kunne ikke hente restaurant: ' +
        restaurantError.message +
        ' — har du kørt ALTER TABLE fra app/dashboard/settings/actions.ts?'
    )
  }

  if (!restaurant) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-full flex-1 bg-[#f9fafb]">
      <header className="border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="font-logo text-xl tracking-tight text-[#111827]">
            Napkind
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-[#6b7280] sm:inline">
              {restaurant.name}
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

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#111827] transition"
        >
          <ArrowLeft size={16} />
          Dashboard
        </Link>

        <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#111827]">
          Indstillinger
        </h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Administrer din restaurant, abonnement og konto
        </p>

        <div className="mt-8">
          <SettingsClient
            userEmail={user.email ?? ''}
            restaurant={restaurant}
          />
        </div>
      </main>
    </div>
  )
}
