import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export type RestaurantContext = {
  supabase: SupabaseClient
  restaurantId: string
}

export async function getRestaurantId(): Promise<RestaurantContext> {
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

export function parseIntField(
  value: FormDataEntryValue | null,
  label: string
): number {
  const n = Number(String(value ?? '').trim())
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`${label} skal være et heltal`)
  }
  return n
}

