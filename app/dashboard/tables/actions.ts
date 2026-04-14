'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`${label} skal være et heltal`)
  }
  return n
}

export async function createTable(formData: FormData) {
  const tableNumber = parseIntField(formData.get('table_number'), 'Bordnummer')
  const capacity = parseIntField(formData.get('capacity'), 'Kapacitet')
  const priority = parseIntField(formData.get('priority'), 'Prioritet')
  const isActive = formData.get('is_active') === 'on'

  if (tableNumber <= 0) throw new Error('Bordnummer skal være større end 0')
  if (capacity <= 0) throw new Error('Kapacitet skal være større end 0')

  const { supabase, restaurantId } = await getRestaurantId()

  const { error } = await supabase.from('restaurant_tables').insert({
    restaurant_id: restaurantId,
    table_number: tableNumber,
    capacity,
    priority,
    is_active: isActive,
  })

  if (error) {
    throw new Error('Kunne ikke oprette bord: ' + error.message)
  }

  revalidatePath('/dashboard/tables')
}

export async function updateTable(id: string, formData: FormData) {
  const tableNumber = parseIntField(formData.get('table_number'), 'Bordnummer')
  const capacity = parseIntField(formData.get('capacity'), 'Kapacitet')
  const priority = parseIntField(formData.get('priority'), 'Prioritet')
  const isActive = formData.get('is_active') === 'on'

  if (tableNumber <= 0) throw new Error('Bordnummer skal være større end 0')
  if (capacity <= 0) throw new Error('Kapacitet skal være større end 0')

  const { supabase, restaurantId } = await getRestaurantId()

  const { error } = await supabase
    .from('restaurant_tables')
    .update({
      table_number: tableNumber,
      capacity,
      priority,
      is_active: isActive,
    })
    .eq('id', id)
    .eq('restaurant_id', restaurantId)

  if (error) {
    throw new Error('Kunne ikke opdatere bord: ' + error.message)
  }

  revalidatePath('/dashboard/tables')
}

export async function deleteTable(id: string) {
  const { supabase, restaurantId } = await getRestaurantId()

  const { error } = await supabase
    .from('restaurant_tables')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurantId)

  if (error) {
    throw new Error('Kunne ikke slette bord: ' + error.message)
  }

  revalidatePath('/dashboard/tables')
}
