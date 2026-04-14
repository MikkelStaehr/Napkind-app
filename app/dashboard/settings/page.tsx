import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { DashboardHeader } from '../_components/dashboard-header'
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
    <div className="min-h-full flex-1 bg-white">
      <DashboardHeader restaurantName={restaurant.name} />

      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#111827] transition"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          Dashboard
        </Link>

        <h1 className="mt-6 font-logo text-4xl tracking-tight text-[#111827]">
          Indstillinger
        </h1>
        <p className="mt-2 text-sm text-[#6b7280]">
          Administrer din restaurant, abonnement og konto
        </p>

        <div className="mt-10">
          <SettingsClient
            userEmail={user.email ?? ''}
            restaurant={restaurant}
          />
        </div>
      </main>
    </div>
  )
}
