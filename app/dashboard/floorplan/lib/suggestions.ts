import { formatTime } from '@/lib/format'
import type { RestaurantTable } from '@/app/types/database'
import type { TablePosition, Zone } from '../../tables/floor-plan'
import type { TableBookings } from './booking-phase'

export type Suggestion = {
  table: RestaurantTable
  zoneName: string | null
  zonePriority: number
  upcomingTime: string | null
}

export function overlaps(
  a: { grid_x: number; grid_y: number; width: number; height: number },
  b: { grid_x: number; grid_y: number; width: number; height: number }
): boolean {
  return (
    a.grid_x < b.grid_x + b.width &&
    a.grid_x + a.width > b.grid_x &&
    a.grid_y < b.grid_y + b.height &&
    a.grid_y + a.height > b.grid_y
  )
}

export function findSuggestions(
  partySize: number,
  tables: RestaurantTable[],
  positions: TablePosition[],
  zones: Zone[],
  tableBookings: Map<string, TableBookings>
): Suggestion[] {
  const positionByTable = new Map<string, TablePosition>()
  for (const p of positions) positionByTable.set(p.table_id, p)

  return tables
    .filter((t) => t.is_active)
    .filter((t) => t.capacity >= partySize)
    .filter((t) => !tableBookings.get(t.id)?.current)
    .map((t) => {
      const pos = positionByTable.get(t.id)
      let zonePriority = Number.POSITIVE_INFINITY
      let zoneName: string | null = null
      if (pos) {
        for (const z of zones) {
          if (z.floor !== pos.floor) continue
          if (overlaps(pos, z) && z.priority < zonePriority) {
            zonePriority = z.priority
            zoneName = z.name
          }
        }
      }
      const upcoming = tableBookings.get(t.id)?.upcoming ?? null
      return {
        table: t,
        zoneName,
        zonePriority,
        upcomingTime: upcoming ? formatTime(upcoming.booking_time) : null,
      }
    })
    .sort((a, b) => {
      if (a.zonePriority !== b.zonePriority) return a.zonePriority - b.zonePriority
      return a.table.capacity - partySize - (b.table.capacity - partySize)
    })
    .slice(0, 3)
}
