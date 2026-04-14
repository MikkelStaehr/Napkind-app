import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { logout } from '../actions'
import { BookingsClient, type BookingRow, type TableOption } from './bookings-client'

export default async function BookingsPage() {
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

  const { data: bookings, error: bookingsError } = await supabase
    .from('restaurant_bookings')
    .select(
      'id, guest_name, guest_email, guest_phone, party_size, booking_date, booking_time, status, notes, table_id, restaurant_tables(table_number)'
    )
    .eq('restaurant_id', link.restaurant_id)
    .order('booking_date', { ascending: true })
    .order('booking_time', { ascending: true })

  if (bookingsError) {
    throw new Error('Kunne ikke hente bookinger: ' + bookingsError.message)
  }

  const { data: tables } = await supabase
    .from('restaurant_tables')
    .select('id, table_number, capacity, is_active')
    .eq('restaurant_id', link.restaurant_id)
    .eq('is_active', true)
    .order('table_number', { ascending: true })

  const bookingRows: BookingRow[] = (bookings ?? []).map((b) => {
    const tableRel = b.restaurant_tables as { table_number?: number } | null
    return {
      id: b.id,
      guest_name: b.guest_name,
      guest_email: b.guest_email,
      guest_phone: b.guest_phone,
      party_size: b.party_size,
      booking_date: b.booking_date,
      booking_time: b.booking_time,
      status: b.status as BookingRow['status'],
      notes: b.notes,
      table_id: b.table_id,
      table_number: tableRel?.table_number ?? null,
    }
  })

  const tableOptions: TableOption[] = (tables ?? []).map((t) => ({
    id: t.id as string,
    table_number: t.table_number as number,
    capacity: t.capacity as number,
  }))

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
              Bookinger
            </h1>
            <p className="mt-1 text-sm text-[#6b7280]">
              Oversigt og administration af alle reservationer
            </p>
          </div>
        </div>

        <div className="mt-6">
          <BookingsClient bookings={bookingRows} tables={tableOptions} />
        </div>
      </main>
    </div>
  )
}
