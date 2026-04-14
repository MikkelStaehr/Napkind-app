'use server'

import { revalidatePath } from 'next/cache'
import { getRestaurantId } from '@/lib/dal'
import type { BookingStatus } from '../bookings/actions'

function revalidate(): void {
  revalidatePath('/dashboard/floorplan')
  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard/calendar')
}

async function setBookingStatus(id: string, status: BookingStatus): Promise<void> {
  const { supabase, restaurantId } = await getRestaurantId()
  const { error } = await supabase
    .from('restaurant_bookings')
    .update({ status })
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
  if (error) {
    throw new Error('Kunne ikke opdatere booking: ' + error.message)
  }
  revalidate()
}

export async function confirmBooking(id: string): Promise<void> {
  await setBookingStatus(id, 'confirmed')
}

export async function cancelBooking(id: string): Promise<void> {
  await setBookingStatus(id, 'cancelled')
}

export type WalkInInput = {
  tableId: string
  partySize: number
  guestName: string
  guestPhone: string
  notes: string
  bookingDate: string
  bookingTime: string
}

export async function createWalkIn(input: WalkInInput): Promise<void> {
  if (!input.tableId) throw new Error('Bord er påkrævet')
  if (!Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > 20) {
    throw new Error('Antal personer skal være mellem 1 og 20')
  }
  if (!input.bookingDate || !input.bookingTime) {
    throw new Error('Dato og tid er påkrævet')
  }

  const { supabase, restaurantId } = await getRestaurantId()

  const guestName = input.guestName.trim() || 'Walk-in'

  const { error } = await supabase.from('restaurant_bookings').insert({
    restaurant_id: restaurantId,
    table_id: input.tableId,
    booking_type_id: null,
    guest_name: guestName,
    guest_email: null,
    guest_phone: input.guestPhone.trim() || null,
    party_size: input.partySize,
    booking_date: input.bookingDate,
    booking_time: input.bookingTime,
    status: 'confirmed' as BookingStatus,
    notes: input.notes.trim() || null,
  })

  if (error) {
    throw new Error('Kunne ikke oprette walk-in: ' + error.message)
  }

  revalidate()
}
