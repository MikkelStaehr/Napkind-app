import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { DashboardHeader } from '../_components/dashboard-header'
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
    (link.restaurants as { name?: string } | null)?.name ?? 'Your restaurant'

  const restaurantId = link.restaurant_id as string

  const [
    { data: bookings, error: bookingsError },
    { data: tables },
  ] = await Promise.all([
    supabase
      .from('restaurant_bookings')
      .select(
        'id, guest_name, guest_email, guest_phone, party_size, booking_date, booking_time, status, notes, table_id, restaurant_tables(table_number)'
      )
      .eq('restaurant_id', restaurantId)
      .order('booking_date', { ascending: true })
      .order('booking_time', { ascending: true }),
    supabase
      .from('restaurant_tables')
      .select('id, table_number, capacity, is_active')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('table_number', { ascending: true }),
  ])

  if (bookingsError) {
    throw new Error('Could not load bookings: ' + bookingsError.message)
  }

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
    <div className="min-h-full flex-1 bg-white">
      <DashboardHeader restaurantName={restaurantName} />

      <main className="mx-auto max-w-5xl px-6 py-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[#6b7280] hover:text-[#111827] transition"
        >
          <ArrowLeft size={14} strokeWidth={1.5} />
          Dashboard
        </Link>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-logo text-4xl tracking-tight text-[#111827]">
              Bookings
            </h1>
            <p className="mt-2 text-sm text-[#6b7280]">
              Overview and management of all reservations
            </p>
          </div>
        </div>

        <div className="mt-8">
          <BookingsClient
            restaurantId={restaurantId}
            bookings={bookingRows}
            tables={tableOptions}
          />
        </div>
      </main>
    </div>
  )
}
