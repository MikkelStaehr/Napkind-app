'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/slugify'

export async function register(formData: FormData) {
  const restaurantName = String(formData.get('restaurantName') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!restaurantName || !email || !password) {
    redirect('/register?error=' + encodeURIComponent('Udfyld venligst alle felter'))
  }

  if (password.length < 6) {
    redirect('/register?error=' + encodeURIComponent('Adgangskoden skal være mindst 6 tegn'))
  }

  const supabase = await createClient()

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (signUpError || !signUpData.user) {
    redirect(
      '/register?error=' +
        encodeURIComponent(signUpError?.message ?? 'Kunne ikke oprette bruger')
    )
  }

  const userId = signUpData.user.id
  const slug = slugify(restaurantName)

  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .insert({
      name: restaurantName,
      slug,
      email,
      plan: 'free',
    })
    .select('id')
    .single()

  if (restaurantError || !restaurant) {
    redirect(
      '/register?error=' +
        encodeURIComponent('Kunne ikke oprette restaurant: ' + (restaurantError?.message ?? ''))
    )
  }

  const { error: linkError } = await supabase.from('restaurant_users').insert({
    restaurant_id: restaurant.id,
    user_id: userId,
    role: 'owner',
  })

  if (linkError) {
    redirect(
      '/register?error=' +
        encodeURIComponent('Kunne ikke knytte bruger til restaurant')
    )
  }

  if (!signUpData.session) {
    redirect('/register?step=check-email&email=' + encodeURIComponent(email))
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
