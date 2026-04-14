'use server'

/*
 * Required schema (run once in Supabase SQL editor):
 *
 * CREATE TABLE IF NOT EXISTS restaurant_table_positions (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
 *   table_id uuid REFERENCES restaurant_tables(id) ON DELETE CASCADE,
 *   grid_x integer NOT NULL DEFAULT 0,
 *   grid_y integer NOT NULL DEFAULT 0,
 *   width integer NOT NULL DEFAULT 2,
 *   height integer NOT NULL DEFAULT 2,
 *   UNIQUE(restaurant_id, table_id)
 * );
 *
 * ALTER TABLE restaurant_table_positions ENABLE ROW LEVEL SECURITY;
 * (See original task spec for policies using get_my_restaurant_ids()).
 */

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

export type TablePositionInput = {
  table_id: string
  grid_x: number
  grid_y: number
  width: number
  height: number
}

export async function saveTablePositions(positions: TablePositionInput[]) {
  const { supabase, restaurantId } = await getRestaurantId()

  if (positions.length === 0) {
    revalidatePath('/dashboard/tables')
    return
  }

  const rows = positions.map((p) => ({
    restaurant_id: restaurantId,
    table_id: p.table_id,
    grid_x: Math.max(0, Math.floor(p.grid_x)),
    grid_y: Math.max(0, Math.floor(p.grid_y)),
    width: Math.max(1, Math.floor(p.width)),
    height: Math.max(1, Math.floor(p.height)),
  }))

  const { error } = await supabase
    .from('restaurant_table_positions')
    .upsert(rows, { onConflict: 'restaurant_id,table_id' })

  if (error) {
    throw new Error('Kunne ikke gemme positioner: ' + error.message)
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
