import type { TodayBooking } from '../../tables/floor-plan'

export type BookingPhase = 'current' | 'upcoming' | 'past'

const CURRENT_WINDOW_BEFORE_MS = 30 * 60 * 1000
const CURRENT_WINDOW_AFTER_MS = 90 * 60 * 1000

export function classifyBooking(b: TodayBooking, now: Date): BookingPhase {
  const [hh, mm] = b.booking_time.split(':').map(Number)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 'past'
  const bookingDate = new Date(now)
  bookingDate.setHours(hh, mm, 0, 0)
  const diffMs = bookingDate.getTime() - now.getTime()
  if (diffMs >= -CURRENT_WINDOW_BEFORE_MS && diffMs <= CURRENT_WINDOW_AFTER_MS) {
    return 'current'
  }
  if (diffMs > CURRENT_WINDOW_AFTER_MS) return 'upcoming'
  return 'past'
}

export type TableBookings = {
  current: TodayBooking | null
  upcoming: TodayBooking | null
}

export function resolveTableBookings(
  bookings: TodayBooking[],
  now: Date
): Map<string, TableBookings> {
  const m = new Map<string, TableBookings>()
  for (const b of bookings) {
    const phase = classifyBooking(b, now)
    const prev = m.get(b.table_id) ?? { current: null, upcoming: null }
    if (phase === 'current' && !prev.current) {
      prev.current = b
    } else if (phase === 'upcoming') {
      if (!prev.upcoming || b.booking_time < prev.upcoming.booking_time) {
        prev.upcoming = b
      }
    }
    m.set(b.table_id, prev)
  }
  return m
}
