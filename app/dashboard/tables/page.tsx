import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { logout } from '../actions'
import type { RestaurantTable } from '@/app/types/database'
import { TablesClient } from './tables-client'
import type {
  TablePosition,
  TodayBooking,
  Zone,
  FloorElement,
} from './floor-plan'

function toDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

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

  const { data: positionRows, error: positionsError } = await supabase
    .from('restaurant_table_positions')
    .select('table_id, floor, grid_x, grid_y, width, height')
    .eq('restaurant_id', link.restaurant_id)

  if (positionsError) {
    throw new Error(
      'Kunne ikke hente bordpositioner: ' +
        positionsError.message +
        ' — har du kørt migrationerne fra app/dashboard/tables/actions.ts?'
    )
  }

  const positions: TablePosition[] = (positionRows ?? []).map((p) => ({
    table_id: p.table_id as string,
    floor: (p.floor as number | null) ?? 1,
    grid_x: p.grid_x as number,
    grid_y: p.grid_y as number,
    width: p.width as number,
    height: p.height as number,
  }))

  const { data: zoneRows, error: zonesError } = await supabase
    .from('restaurant_zones')
    .select('id, name, priority, color, floor, grid_x, grid_y, width, height')
    .eq('restaurant_id', link.restaurant_id)

  if (zonesError) {
    throw new Error(
      'Kunne ikke hente zoner: ' +
        zonesError.message +
        ' — har du kørt migrationerne fra app/dashboard/tables/actions.ts?'
    )
  }

  const zones: Zone[] = (zoneRows ?? []).map((z) => ({
    id: z.id as string,
    name: (z.name as string) ?? '',
    priority: (z.priority as number | null) ?? 1,
    color: ((z.color as string | null) ?? 'amber') as Zone['color'],
    floor: (z.floor as number | null) ?? 1,
    grid_x: (z.grid_x as number | null) ?? 0,
    grid_y: (z.grid_y as number | null) ?? 0,
    width: (z.width as number | null) ?? 4,
    height: (z.height as number | null) ?? 4,
  }))

  const { data: elementRows, error: elementsError } = await supabase
    .from('restaurant_floor_elements')
    .select('id, type, floor, grid_x, grid_y, width, height, label')
    .eq('restaurant_id', link.restaurant_id)

  if (elementsError) {
    throw new Error(
      'Kunne ikke hente plantegning-elementer: ' +
        elementsError.message +
        ' — har du kørt migrationerne fra app/dashboard/tables/actions.ts?'
    )
  }

  const elements: FloorElement[] = (elementRows ?? []).map((e) => ({
    id: e.id as string,
    type: e.type as FloorElement['type'],
    floor: (e.floor as number | null) ?? 1,
    grid_x: (e.grid_x as number | null) ?? 0,
    grid_y: (e.grid_y as number | null) ?? 0,
    width: (e.width as number | null) ?? 1,
    height: (e.height as number | null) ?? 1,
    label: (e.label as string | null) ?? null,
  }))

  const today = toDateKey(new Date())
  const { data: bookingRows } = await supabase
    .from('restaurant_bookings')
    .select(
      'id, table_id, guest_name, guest_phone, party_size, booking_time, status, notes'
    )
    .eq('restaurant_id', link.restaurant_id)
    .eq('booking_date', today)
    .in('status', ['pending', 'confirmed'])
    .order('booking_time', { ascending: true })

  const todayBookings: TodayBooking[] = (bookingRows ?? [])
    .filter((b) => b.table_id)
    .map((b) => ({
      id: b.id as string,
      table_id: b.table_id as string,
      guest_name: b.guest_name as string,
      guest_phone: (b.guest_phone as string | null) ?? null,
      party_size: b.party_size as number,
      booking_time: b.booking_time as string,
      status: b.status as 'pending' | 'confirmed',
      notes: (b.notes as string | null) ?? null,
    }))

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
          <TablesClient
            tables={(tables ?? []) as RestaurantTable[]}
            positions={positions}
            zones={zones}
            elements={elements}
            todayBookings={todayBookings}
            restaurantId={link.restaurant_id as string}
          />
        </div>
      </main>
    </div>
  )
}
