import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { logout } from '../actions'
import type { RestaurantTable } from '@/app/types/database'
import { TablesClient } from './tables-client'

export default async function TablesPage() {
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

  if (!link?.restaurant_id) {
    redirect('/dashboard')
  }

  const restaurantName =
    (link.restaurants as { name?: string } | null)?.name ?? 'Din restaurant'

  const { data: tables } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('restaurant_id', link.restaurant_id)
    .order('table_number', { ascending: true })

  return (
    <div className="min-h-full flex-1 bg-[#f9fafb]">
      <header className="border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-xl font-bold tracking-tight text-[#111827]">
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
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#111827] transition"
        >
          <ArrowLeft size={16} />
          Dashboard
        </Link>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
              Borde
            </h1>
            <p className="mt-1 text-sm text-[#6b7280]">
              Administrer dine borde, kapacitet og prioritet
            </p>
          </div>
        </div>

        <div className="mt-6">
          <TablesClient tables={(tables ?? []) as RestaurantTable[]} />
        </div>
      </main>
    </div>
  )
}
