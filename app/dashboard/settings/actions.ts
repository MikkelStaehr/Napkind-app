'use server'

/*
 * Required schema additions (run once in Supabase SQL editor):
 *
 * ALTER TABLE restaurants
 *   ADD COLUMN IF NOT EXISTS address text,
 *   ADD COLUMN IF NOT EXISTS phone text,
 *   ADD COLUMN IF NOT EXISTS email text;
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

type ActionResult = { ok: true } | { ok: false; error: string }

async function requireUserAndRestaurant() {
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

  return { supabase, user, restaurantId: link.restaurant_id as string }
}

export async function updateRestaurantInfo(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get('name') ?? '').trim()
  const address = String(formData.get('address') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()

  if (!name) {
    return { ok: false, error: 'Restaurantnavn må ikke være tomt' }
  }

  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (email.length > 254 || !emailRegex.test(email)) {
      return { ok: false, error: 'Ugyldig email-adresse' }
    }
  }

  const { supabase, restaurantId } = await requireUserAndRestaurant()

  const { error } = await supabase
    .from('restaurants')
    .update({
      name,
      address: address || null,
      phone: phone || null,
      email: email || null,
    })
    .eq('id', restaurantId)

  if (error) {
    return { ok: false, error: 'Kunne ikke gemme: ' + error.message }
  }

  revalidatePath('/dashboard/settings')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function changePassword(formData: FormData): Promise<ActionResult> {
  const newPassword = String(formData.get('new_password') ?? '')
  const confirmPassword = String(formData.get('confirm_password') ?? '')

  if (newPassword.length < 6) {
    return { ok: false, error: 'Adgangskoden skal være mindst 6 tegn' }
  }

  if (newPassword !== confirmPassword) {
    return { ok: false, error: 'De to adgangskoder er ikke ens' }
  }

  const { supabase } = await requireUserAndRestaurant()

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) {
    return { ok: false, error: 'Kunne ikke ændre adgangskode: ' + error.message }
  }

  revalidatePath('/dashboard/settings')
  return { ok: true }
}

export async function deleteAccount(): Promise<void> {
  const { supabase, user, restaurantId } = await requireUserAndRestaurant()

  const { error: linksError } = await supabaseAdmin
    .from('restaurant_users')
    .delete()
    .eq('restaurant_id', restaurantId)

  if (linksError) {
    throw new Error('Kunne ikke slette bruger-tilknytninger: ' + linksError.message)
  }

  const { error: restaurantError } = await supabaseAdmin
    .from('restaurants')
    .delete()
    .eq('id', restaurantId)

  if (restaurantError) {
    throw new Error('Kunne ikke slette restaurant: ' + restaurantError.message)
  }

  const { error: userError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

  if (userError) {
    throw new Error('Kunne ikke slette bruger: ' + userError.message)
  }

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
