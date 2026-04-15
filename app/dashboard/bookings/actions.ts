'use server'

import { revalidatePath } from 'next/cache'
import { getRestaurantId, parseIntField } from '@/lib/dal'
import { sendBookingConfirmation, sendBookingCancellation } from '@/lib/email'
import { log } from '@/lib/logger'

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled'

export async function createBooking(formData: FormData): Promise<void> {
  const guestName = String(formData.get('guest_name') ?? '').trim()
  const guestEmail = String(formData.get('guest_email') ?? '').trim()
  const guestPhone = String(formData.get('guest_phone') ?? '').trim()
  const partySize = parseIntField(formData.get('party_size'), 'Antal personer')
  const bookingDate = String(formData.get('booking_date') ?? '').trim()
  const bookingTime = String(formData.get('booking_time') ?? '').trim()
  const tableIdRaw = String(formData.get('table_id') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

  if (partySize <= 0) throw new Error('Antal personer skal være større end 0')
  if (!guestName) throw new Error('Gæstenavn er påkrævet')
  if (!bookingDate) throw new Error('Dato er påkrævet')
  if (!bookingTime) throw new Error('Tid er påkrævet')

  const { supabase, restaurantId } = await getRestaurantId()

  const { error } = await supabase.from('restaurant_bookings').insert({
    restaurant_id: restaurantId,
    table_id: tableIdRaw || null,
    booking_type_id: null,
    guest_name: guestName,
    guest_email: guestEmail || null,
    guest_phone: guestPhone || null,
    party_size: partySize,
    booking_date: bookingDate,
    booking_time: bookingTime,
    status: 'confirmed' as BookingStatus,
    notes: notes || null,
  })

  if (error) {
    throw new Error('Kunne ikke oprette booking: ' + error.message)
  }

  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard/calendar')
}

export async function updateBookingStatus(
  id: string,
  status: BookingStatus
): Promise<void> {
  if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
    throw new Error('Ugyldig status')
  }

  const { supabase, restaurantId } = await getRestaurantId()

  const { data: before } = await supabase
    .from('restaurant_bookings')
    .select('status')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  const { error } = await supabase
    .from('restaurant_bookings')
    .update({ status })
    .eq('id', id)
    .eq('restaurant_id', restaurantId)

  if (error) {
    throw new Error('Kunne ikke opdatere booking: ' + error.message)
  }

  if (before?.status !== status && (status === 'confirmed' || status === 'cancelled')) {
    await notifyGuestAboutStatusChange(id, restaurantId, status)
  }

  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard/calendar')
}

async function notifyGuestAboutStatusChange(
  bookingId: string,
  restaurantId: string,
  status: 'confirmed' | 'cancelled'
): Promise<void> {
  const { supabase } = await getRestaurantId()

  const { data: booking } = await supabase
    .from('restaurant_bookings')
    .select(
      'guest_name, guest_email, party_size, booking_date, booking_time, notes, restaurants(name)'
    )
    .eq('id', bookingId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (!booking?.guest_email) return

  const restaurantName =
    (booking.restaurants as { name?: string } | null)?.name ?? 'Restauranten'

  const input = {
    to: booking.guest_email as string,
    guestName: booking.guest_name as string,
    restaurantName,
    partySize: booking.party_size as number,
    bookingDate: booking.booking_date as string,
    bookingTime: booking.booking_time as string,
    notes: booking.notes as string | null,
  }

  try {
    if (status === 'confirmed') {
      await sendBookingConfirmation(input)
    } else {
      await sendBookingCancellation(input)
    }
  } catch (err) {
    log.error('email.booking_notification_failed', err, { bookingId, status })
  }
}

export async function deleteBooking(id: string): Promise<void> {
  const { supabase, restaurantId } = await getRestaurantId()

  const { data: existing, error: fetchError } = await supabase
    .from('restaurant_bookings')
    .select('status')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()

  if (fetchError) {
    throw new Error('Kunne ikke hente booking: ' + fetchError.message)
  }

  if (!existing) {
    throw new Error('Booking findes ikke')
  }

  if (existing.status !== 'cancelled') {
    throw new Error('Kun annullerede bookinger kan slettes')
  }

  const { error } = await supabase
    .from('restaurant_bookings')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurantId)

  if (error) {
    throw new Error('Kunne ikke slette booking: ' + error.message)
  }

  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard/calendar')
}
