'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect('/login?error=' + encodeURIComponent('Udfyld venligst alle felter'))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=' + encodeURIComponent('Forkert email eller adgangskode'))
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}
