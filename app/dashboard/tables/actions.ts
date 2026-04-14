'use server'

/*
 * Required schema — run once in Supabase SQL editor:
 *
 * -- restaurant_table_positions: add floor column for multi-floor support
 * ALTER TABLE restaurant_table_positions
 *   ADD COLUMN IF NOT EXISTS floor integer NOT NULL DEFAULT 1;
 *
 * -- Structural elements (kitchen, door, bar, window, wall)
 * CREATE TABLE IF NOT EXISTS restaurant_floor_elements (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
 *   type text NOT NULL,
 *   floor integer NOT NULL DEFAULT 1,
 *   grid_x integer NOT NULL DEFAULT 0,
 *   grid_y integer NOT NULL DEFAULT 0,
 *   width integer NOT NULL DEFAULT 1,
 *   height integer NOT NULL DEFAULT 1,
 *   rotation integer NOT NULL DEFAULT 0,
 *   label text,
 *   created_at timestamptz DEFAULT now()
 * );
 * ALTER TABLE restaurant_floor_elements
 *   ADD COLUMN IF NOT EXISTS rotation integer NOT NULL DEFAULT 0;
 * ALTER TABLE restaurant_floor_elements ENABLE ROW LEVEL SECURITY;
 * -- Policies use get_my_restaurant_ids() — see task spec.
 *
 * -- Zones (create if not exists, plus add any missing columns)
 * CREATE TABLE IF NOT EXISTS restaurant_zones (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
 *   name text NOT NULL,
 *   priority integer NOT NULL DEFAULT 1,
 *   color text NOT NULL DEFAULT 'amber',
 *   floor integer NOT NULL DEFAULT 1,
 *   grid_x integer NOT NULL DEFAULT 0,
 *   grid_y integer NOT NULL DEFAULT 0,
 *   width integer NOT NULL DEFAULT 4,
 *   height integer NOT NULL DEFAULT 4,
 *   created_at timestamptz DEFAULT now()
 * );
 * ALTER TABLE restaurant_zones
 *   ADD COLUMN IF NOT EXISTS floor integer NOT NULL DEFAULT 1,
 *   ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'amber',
 *   ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 1,
 *   ADD COLUMN IF NOT EXISTS grid_x integer NOT NULL DEFAULT 0,
 *   ADD COLUMN IF NOT EXISTS grid_y integer NOT NULL DEFAULT 0,
 *   ADD COLUMN IF NOT EXISTS width integer NOT NULL DEFAULT 4,
 *   ADD COLUMN IF NOT EXISTS height integer NOT NULL DEFAULT 4;
 * ALTER TABLE restaurant_zones ENABLE ROW LEVEL SECURITY;
 */

import { revalidatePath } from 'next/cache'
import { getRestaurantId, parseIntField } from '@/lib/dal'

export type CreatedTable = {
  id: string
  restaurant_id: string
  table_number: number
  capacity: number
  priority: number
  is_active: boolean
  created_at: string
}

export async function createTable(formData: FormData): Promise<CreatedTable> {
  const tableNumber = parseIntField(formData.get('table_number'), 'Bordnummer')
  const capacity = parseIntField(formData.get('capacity'), 'Kapacitet')
  const priorityRaw = formData.get('priority')
  const priority =
    priorityRaw === null || String(priorityRaw).trim() === ''
      ? 10
      : parseIntField(priorityRaw, 'Prioritet')
  const isActive = formData.get('is_active') === null ? true : formData.get('is_active') === 'on'

  if (tableNumber <= 0) throw new Error('Bordnummer skal være større end 0')
  if (capacity <= 0) throw new Error('Kapacitet skal være større end 0')

  const { supabase, restaurantId } = await getRestaurantId()

  const { data, error } = await supabase
    .from('restaurant_tables')
    .insert({
      restaurant_id: restaurantId,
      table_number: tableNumber,
      capacity,
      priority,
      is_active: isActive,
    })
    .select('id, restaurant_id, table_number, capacity, priority, is_active, created_at')
    .single()

  if (error || !data) {
    throw new Error('Kunne ikke oprette bord: ' + (error?.message ?? 'ukendt fejl'))
  }

  revalidatePath('/dashboard/tables')
  return data as CreatedTable
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
  floor: number
  grid_x: number
  grid_y: number
  width: number
  height: number
}

export type FloorElementType = 'kitchen' | 'door' | 'bar' | 'window' | 'wall' | 'toilet'

export type FloorElementInput = {
  id: string
  type: FloorElementType
  floor: number
  grid_x: number
  grid_y: number
  width: number
  height: number
  rotation: number
  label: string | null
}

export type ZoneColor = 'amber' | 'green' | 'blue' | 'purple' | 'red' | 'gray'

export type ZoneInput = {
  id: string
  name: string
  priority: number
  color: ZoneColor
  floor: number
  grid_x: number
  grid_y: number
  width: number
  height: number
}

const VALID_ELEMENT_TYPES: ReadonlySet<string> = new Set([
  'kitchen',
  'door',
  'bar',
  'window',
  'wall',
  'toilet',
])

const VALID_ZONE_COLORS: ReadonlySet<string> = new Set([
  'amber',
  'green',
  'blue',
  'purple',
  'red',
  'gray',
])

export async function saveTablePositions(positions: TablePositionInput[]) {
  const { supabase, restaurantId } = await getRestaurantId()

  const { error: deleteError } = await supabase
    .from('restaurant_table_positions')
    .delete()
    .eq('restaurant_id', restaurantId)

  if (deleteError) {
    throw new Error('Kunne ikke rydde gamle positioner: ' + deleteError.message)
  }

  if (positions.length > 0) {
    const rows = positions.map((p) => ({
      restaurant_id: restaurantId,
      table_id: p.table_id,
      floor: Math.max(1, Math.floor(p.floor)),
      grid_x: Math.max(0, Math.floor(p.grid_x)),
      grid_y: Math.max(0, Math.floor(p.grid_y)),
      width: Math.max(1, Math.floor(p.width)),
      height: Math.max(1, Math.floor(p.height)),
    }))

    const { error: insertError } = await supabase
      .from('restaurant_table_positions')
      .insert(rows)

    if (insertError) {
      throw new Error('Kunne ikke gemme positioner: ' + insertError.message)
    }
  }

  revalidatePath('/dashboard/tables')
}

export async function saveFloorElements(elements: FloorElementInput[]) {
  const { supabase, restaurantId } = await getRestaurantId()

  for (const el of elements) {
    if (!VALID_ELEMENT_TYPES.has(el.type)) {
      throw new Error(`Ugyldig elementtype: ${el.type}`)
    }
  }

  const { error: deleteError } = await supabase
    .from('restaurant_floor_elements')
    .delete()
    .eq('restaurant_id', restaurantId)

  if (deleteError) {
    throw new Error('Kunne ikke rydde gamle elementer: ' + deleteError.message)
  }

  if (elements.length > 0) {
    const rows = elements.map((e) => {
      const rot = ((Math.floor(e.rotation ?? 0) % 360) + 360) % 360
      const snapped = rot - (rot % 90)
      return {
        id: e.id,
        restaurant_id: restaurantId,
        type: e.type,
        floor: Math.max(1, Math.floor(e.floor)),
        grid_x: Math.max(0, Math.floor(e.grid_x)),
        grid_y: Math.max(0, Math.floor(e.grid_y)),
        width: Math.max(1, Math.floor(e.width)),
        height: Math.max(1, Math.floor(e.height)),
        rotation: snapped,
        label: e.label,
      }
    })

    const { error: insertError } = await supabase
      .from('restaurant_floor_elements')
      .insert(rows)

    if (insertError) {
      throw new Error('Kunne ikke gemme elementer: ' + insertError.message)
    }
  }

  revalidatePath('/dashboard/tables')
}

export async function deleteFloorElement(id: string) {
  const { supabase, restaurantId } = await getRestaurantId()

  const { error } = await supabase
    .from('restaurant_floor_elements')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurantId)

  if (error) {
    throw new Error('Kunne ikke slette element: ' + error.message)
  }

  revalidatePath('/dashboard/tables')
}

export async function saveZones(zones: ZoneInput[]) {
  const { supabase, restaurantId } = await getRestaurantId()

  for (const z of zones) {
    if (!VALID_ZONE_COLORS.has(z.color)) {
      throw new Error(`Ugyldig farve: ${z.color}`)
    }
    if (!z.name.trim()) {
      throw new Error('Zonenavn er påkrævet')
    }
  }

  const { error: deleteError } = await supabase
    .from('restaurant_zones')
    .delete()
    .eq('restaurant_id', restaurantId)

  if (deleteError) {
    throw new Error('Kunne ikke rydde gamle zoner: ' + deleteError.message)
  }

  if (zones.length > 0) {
    const rows = zones.map((z) => ({
      id: z.id,
      restaurant_id: restaurantId,
      name: z.name.trim(),
      priority: Math.max(1, Math.floor(z.priority)),
      color: z.color,
      floor: Math.max(1, Math.floor(z.floor)),
      grid_x: Math.max(0, Math.floor(z.grid_x)),
      grid_y: Math.max(0, Math.floor(z.grid_y)),
      width: Math.max(1, Math.floor(z.width)),
      height: Math.max(1, Math.floor(z.height)),
    }))

    const { error: insertError } = await supabase
      .from('restaurant_zones')
      .insert(rows)

    if (insertError) {
      throw new Error('Kunne ikke gemme zoner: ' + insertError.message)
    }
  }

  revalidatePath('/dashboard/tables')
}

export async function deleteZone(id: string) {
  const { supabase, restaurantId } = await getRestaurantId()

  const { error } = await supabase
    .from('restaurant_zones')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurantId)

  if (error) {
    throw new Error('Kunne ikke slette zone: ' + error.message)
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
