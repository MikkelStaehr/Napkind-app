'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { slugify } from '@/lib/slugify'

export async function register(formData: FormData) {
  const restaurantName = String(formData.get('restaurantName') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!restaurantName || !email || !password) {
    redirect('/register?error=' + encodeURIComponent('Please fill in all fields'))
  }

  if (password.length < 6) {
    redirect('/register?error=' + encodeURIComponent('Password must be at least 6 characters'))
  }

  const supabase = await createClient()

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (signUpError || !signUpData.user) {
    redirect(
      '/register?error=' +
        encodeURIComponent(signUpError?.message ?? 'Could not create user')
    )
  }

  const userId = signUpData.user.id
  const slug = slugify(restaurantName)

  const { data: restaurant, error: restaurantError } = await supabaseAdmin
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
        encodeURIComponent('Could not create restaurant: ' + (restaurantError?.message ?? ''))
    )
  }

  const { error: linkError } = await supabaseAdmin.from('restaurant_users').insert({
    restaurant_id: restaurant.id,
    user_id: userId,
    role: 'owner',
  })

  if (linkError) {
    redirect(
      '/register?error=' +
        encodeURIComponent('Could not link user to restaurant')
    )
  }

  if (!signUpData.session) {
    redirect('/register?step=check-email&email=' + encodeURIComponent(email))
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
