'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled'

async function getRestaurantId() {
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
    throw new Error('Ingen restaurant fundet for bruger')
  }

  return { supabase, restaurantId: link.restaurant_id as string }
}

function parseIntField(value: FormDataEntryValue | null, label: string) {
  const n = Number(String(value ?? '').trim())
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(`${label} skal være et positivt heltal`)
  }
  return n
}

export async function createBooking(formData: FormData) {
  const guestName = String(formData.get('guest_name') ?? '').trim()
  const guestEmail = String(formData.get('guest_email') ?? '').trim()
  const guestPhone = String(formData.get('guest_phone') ?? '').trim()
  const partySize = parseIntField(formData.get('party_size'), 'Antal personer')
  const bookingDate = String(formData.get('booking_date') ?? '').trim()
  const bookingTime = String(formData.get('booking_time') ?? '').trim()
  const tableIdRaw = String(formData.get('table_id') ?? '').trim()
  const notes = String(formData.get('notes') ?? '').trim()

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

export async function updateBookingStatus(id: string, status: BookingStatus) {
  if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
    throw new Error('Ugyldig status')
  }

  const { supabase, restaurantId } = await getRestaurantId()

  const { error } = await supabase
    .from('restaurant_bookings')
    .update({ status })
    .eq('id', id)
    .eq('restaurant_id', restaurantId)

  if (error) {
    throw new Error('Kunne ikke opdatere booking: ' + error.message)
  }

  revalidatePath('/dashboard/bookings')
  revalidatePath('/dashboard/calendar')
}

export async function deleteBooking(id: string) {
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
