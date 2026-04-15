import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { toDateKey } from '@/lib/format'
import type { RestaurantTable } from '@/app/types/database'
import type {
  FloorElement,
  TablePosition,
  TodayBooking,
  Zone,
} from '../tables/floor-plan'
import { FloorplanClient } from './floorplan-client'

export default async function FloorplanPage() {
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
  const today = toDateKey(new Date())

  const [
    { data: tableRows },
    { data: positionRows },
    { data: zoneRows },
    { data: elementRows },
    { data: bookingRows },
  ] = await Promise.all([
    supabase
      .from('restaurant_tables')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('table_number', { ascending: true }),
    supabase
      .from('restaurant_table_positions')
      .select('table_id, floor, grid_x, grid_y, width, height')
      .eq('restaurant_id', restaurantId),
    supabase
      .from('restaurant_zones')
      .select('id, name, priority, color, floor, grid_x, grid_y, width, height')
      .eq('restaurant_id', restaurantId),
    supabase
      .from('restaurant_floor_elements')
      .select('id, type, floor, grid_x, grid_y, width, height, rotation, label')
      .eq('restaurant_id', restaurantId),
    supabase
      .from('restaurant_bookings')
      .select(
        'id, table_id, guest_name, guest_phone, party_size, booking_time, status, notes'
      )
      .eq('restaurant_id', restaurantId)
      .eq('booking_date', today)
      .in('status', ['pending', 'confirmed'])
      .order('booking_time', { ascending: true }),
  ])

  const tables = (tableRows ?? []) as RestaurantTable[]

  const positions: TablePosition[] = (positionRows ?? []).map((p) => ({
    table_id: p.table_id as string,
    floor: (p.floor as number | null) ?? 1,
    grid_x: p.grid_x as number,
    grid_y: p.grid_y as number,
    width: p.width as number,
    height: p.height as number,
  }))

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

  const elements: FloorElement[] = (elementRows ?? []).map((e) => ({
    id: e.id as string,
    type: e.type as FloorElement['type'],
    floor: (e.floor as number | null) ?? 1,
    grid_x: (e.grid_x as number | null) ?? 0,
    grid_y: (e.grid_y as number | null) ?? 0,
    width: (e.width as number | null) ?? 1,
    height: (e.height as number | null) ?? 1,
    rotation: (e.rotation as number | null) ?? 0,
    label: (e.label as string | null) ?? null,
  }))

  const bookings: TodayBooking[] = (bookingRows ?? [])
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
    <FloorplanClient
      restaurantId={restaurantId}
      restaurantName={restaurantName}
      tables={tables}
      positions={positions}
      zones={zones}
      elements={elements}
      bookings={bookings}
      today={today}
    />
  )
}
