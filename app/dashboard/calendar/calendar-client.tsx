'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Phone,
  Users,
  X,
} from 'lucide-react'
import {
  createBooking,
  updateBookingStatus,
  type BookingStatus,
} from '../bookings/actions'
import { toDateKey } from '@/lib/format'
import { FLOOR_PLAN_HOUR_END, FLOOR_PLAN_HOUR_START } from '@/lib/constants'

export type CalendarBooking = {
  id: string
  guest_name: string
  guest_phone: string | null
  party_size: number
  booking_date: string
  booking_time: string
  status: BookingStatus
  notes: string | null
  table_id: string | null
  table_number: number | null
}

export type TableOption = {
  id: string
  table_number: number
  capacity: number
}

type View = 'day' | 'week' | 'month'

const MONTHS_DA = [
  'januar',
  'februar',
  'marts',
  'april',
  'maj',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'december',
]

const WEEKDAYS_SHORT = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn']
const WEEKDAYS_LONG = [
  'mandag',
  'tirsdag',
  'onsdag',
  'torsdag',
  'fredag',
  'lørdag',
  'søndag',
]

const HOURS = Array.from(
  { length: FLOOR_PLAN_HOUR_END - FLOOR_PLAN_HOUR_START + 1 },
  (_, i) => FLOOR_PLAN_HOUR_START + i
)

const statusMeta: Record<BookingStatus, { label: string; badge: string; card: string; dot: string }> = {
  pending: {
    label: 'Afventer',
    badge: 'bg-[#fffbeb] text-[#b45309]',
    card: 'border-[#fcd34d] bg-[#fffbeb] text-[#92400e]',
    dot: 'bg-[#f59e0b]',
  },
  confirmed: {
    label: 'Bekræftet',
    badge: 'bg-[#ecfdf5] text-[#047857]',
    card: 'border-[#6ee7b7] bg-[#ecfdf5] text-[#065f46]',
    dot: 'bg-[#10b981]',
  },
  cancelled: {
    label: 'Annulleret',
    badge: 'bg-[#f3f4f6] text-[#6b7280]',
    card: 'border-[#e5e7eb] bg-[#f9fafb] text-[#6b7280]',
    dot: 'bg-[#9ca3af]',
  },
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d)
  x.setMonth(x.getMonth() + n)
  return x
}

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}

function formatDayLong(d: Date): string {
  return `${d.getDate()}. ${MONTHS_DA[d.getMonth()]} ${d.getFullYear()}`
}

function formatMonthYear(d: Date): string {
  const m = MONTHS_DA[d.getMonth()]
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${d.getFullYear()}`
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6)
  const sameMonth = start.getMonth() === end.getMonth()
  const sameYear = start.getFullYear() === end.getFullYear()
  if (sameMonth) {
    return `${start.getDate()}.–${end.getDate()}. ${MONTHS_DA[end.getMonth()]} ${end.getFullYear()}`
  }
  if (sameYear) {
    return `${start.getDate()}. ${MONTHS_DA[start.getMonth()]} – ${end.getDate()}. ${MONTHS_DA[end.getMonth()]} ${end.getFullYear()}`
  }
  return `${start.getDate()}. ${MONTHS_DA[start.getMonth()]} ${start.getFullYear()} – ${end.getDate()}. ${MONTHS_DA[end.getMonth()]} ${end.getFullYear()}`
}

function parseTimeHour(t: string): number {
  return Number(t.slice(0, 2))
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

function bookingsByDate(bookings: CalendarBooking[]): Map<string, CalendarBooking[]> {
  const map = new Map<string, CalendarBooking[]>()
  for (const b of bookings) {
    const list = map.get(b.booking_date) ?? []
    list.push(b)
    map.set(b.booking_date, list)
  }
  return map
}

type CreateDraft = { date: string; time: string }

export function CalendarClient({
  bookings,
  tables,
  today,
}: {
  bookings: CalendarBooking[]
  tables: TableOption[]
  today: string
}) {
  const [view, setView] = useState<View>('day')
  const [focalKey, setFocalKey] = useState<string>(today)
  const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null)
  const [selected, setSelected] = useState<CalendarBooking | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const focal = useMemo(() => parseDateKey(focalKey), [focalKey])
  const byDate = useMemo(() => bookingsByDate(bookings), [bookings])

  const navigate = (delta: number) => {
    if (view === 'day') setFocalKey(toDateKey(addDays(focal, delta)))
    else if (view === 'week') setFocalKey(toDateKey(addDays(focal, delta * 7)))
    else setFocalKey(toDateKey(addMonths(focal, delta)))
  }

  const goToday = () => setFocalKey(today)

  const openDay = (dateKey: string) => {
    setFocalKey(dateKey)
    setView('day')
  }

  const handleCreate = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      try {
        await createBooking(formData)
        setCreateDraft(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke oprette booking')
      }
    })
  }

  const handleStatus = (id: string, status: BookingStatus) => {
    setError(null)
    startTransition(async () => {
      try {
        await updateBookingStatus(id, status)
        setSelected(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke opdatere booking')
      }
    })
  }

  const label =
    view === 'day'
      ? formatDayLong(focal)
      : view === 'week'
        ? formatWeekRange(startOfWeekMonday(focal))
        : formatMonthYear(focal)

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-[#e5e7eb] bg-white p-0.5 self-start">
          {(
            [
              { v: 'day', l: 'Dag' },
              { v: 'week', l: 'Uge' },
              { v: 'month', l: 'Måned' },
            ] as { v: View; l: string }[]
          ).map((o) => {
            const active = o.v === view
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => setView(o.v)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'bg-[#f59e0b] text-white'
                    : 'text-[#6b7280] hover:text-[#111827]'
                }`}
              >
                {o.l}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#111827] hover:text-[#111827] transition"
            aria-label="Forrige"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-[#111827] hover:border-[#111827] transition"
          >
            I dag
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#6b7280] hover:border-[#111827] hover:text-[#111827] transition"
            aria-label="Næste"
          >
            <ChevronRight size={16} />
          </button>
          <div className="ml-2 text-sm font-semibold text-[#111827] capitalize">
            {label}
          </div>
        </div>
      </div>

      {view === 'day' && (
        <DayView
          date={focal}
          byDate={byDate}
          today={today}
          onCreate={(time) => setCreateDraft({ date: toDateKey(focal), time })}
          onSelect={setSelected}
        />
      )}
      {view === 'week' && (
        <WeekView
          weekStart={startOfWeekMonday(focal)}
          byDate={byDate}
          today={today}
          onCreate={(dateKey, time) => setCreateDraft({ date: dateKey, time })}
          onSelect={setSelected}
        />
      )}
      {view === 'month' && (
        <MonthView
          focal={focal}
          byDate={byDate}
          today={today}
          onOpenDay={openDay}
        />
      )}

      {createDraft && (
        <CreateModal
          tables={tables}
          draft={createDraft}
          pending={pending}
          onSubmit={handleCreate}
          onClose={() => {
            setError(null)
            setCreateDraft(null)
          }}
        />
      )}

      {selected && (
        <DetailModal
          booking={selected}
          pending={pending}
          onStatus={handleStatus}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

function DayView({
  date,
  byDate,
  today,
  onCreate,
  onSelect,
}: {
  date: Date
  byDate: Map<string, CalendarBooking[]>
  today: string
  onCreate: (time: string) => void
  onSelect: (b: CalendarBooking) => void
}) {
  const key = toDateKey(date)
  const list = (byDate.get(key) ?? []).slice().sort((a, b) =>
    a.booking_time.localeCompare(b.booking_time)
  )
  const isToday = key === today

  const byHour = new Map<number, CalendarBooking[]>()
  for (const b of list) {
    const h = parseTimeHour(b.booking_time)
    const arr = byHour.get(h) ?? []
    arr.push(b)
    byHour.set(h, arr)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
      {list.length === 0 && (
        <div className="border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-center text-xs text-[#6b7280]">
          Ingen bookinger denne dag {isToday ? '— klik på et tidsrum for at oprette' : ''}
        </div>
      )}
      <div className="divide-y divide-[#e5e7eb]">
        {HOURS.map((h) => {
          const slot = byHour.get(h) ?? []
          const time = `${String(h).padStart(2, '0')}:00`
          return (
            <div key={h} className="flex min-h-14 items-stretch">
              <div className="w-16 shrink-0 border-r border-[#e5e7eb] px-3 py-2 text-xs font-medium text-[#6b7280]">
                {time}
              </div>
              <button
                type="button"
                onClick={() => onCreate(time)}
                className="group relative flex-1 px-3 py-2 text-left hover:bg-[#fffbeb] transition"
                aria-label={`Opret booking kl. ${time}`}
              >
                {slot.length === 0 ? (
                  <span className="text-xs text-transparent group-hover:text-[#f59e0b]">
                    + Ny booking kl. {time}
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slot.map((b) => (
                      <BookingCard
                        key={b.id}
                        booking={b}
                        onClick={() => onSelect(b)}
                      />
                    ))}
                  </div>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekView({
  weekStart,
  byDate,
  today,
  onCreate,
  onSelect,
}: {
  weekStart: Date
  byDate: Map<string, CalendarBooking[]>
  today: string
  onCreate: (dateKey: string, time: string) => void
  onSelect: (b: CalendarBooking) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const totalBookings = days.reduce(
    (acc, d) => acc + (byDate.get(toDateKey(d))?.length ?? 0),
    0
  )

  return (
    <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
      {totalBookings === 0 && (
        <div className="border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-center text-xs text-[#6b7280]">
          Ingen bookinger denne uge
        </div>
      )}
      <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b border-[#e5e7eb] bg-[#f9fafb]">
        <div />
        {days.map((d, i) => {
          const key = toDateKey(d)
          const isToday = key === today
          return (
            <div
              key={key}
              className={`border-l border-[#e5e7eb] px-2 py-2 text-center text-xs font-medium ${
                isToday ? 'text-[#f59e0b]' : 'text-[#6b7280]'
              }`}
            >
              <div className="uppercase">{WEEKDAYS_SHORT[i]}</div>
              <div className="mt-0.5 text-sm text-[#111827]">{d.getDate()}</div>
            </div>
          )
        })}
      </div>
      <div className="divide-y divide-[#e5e7eb]">
        {HOURS.map((h) => {
          const time = `${String(h).padStart(2, '0')}:00`
          return (
            <div
              key={h}
              className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] min-h-12"
            >
              <div className="flex items-start border-r border-[#e5e7eb] px-3 py-1.5 text-xs font-medium text-[#6b7280]">
                {time}
              </div>
              {days.map((d) => {
                const dayKey = toDateKey(d)
                const slot = (byDate.get(dayKey) ?? []).filter(
                  (b) => parseTimeHour(b.booking_time) === h
                )
                return (
                  <button
                    key={`${dayKey}-${h}`}
                    type="button"
                    onClick={() => onCreate(dayKey, time)}
                    className="group border-l border-[#e5e7eb] p-1 text-left hover:bg-[#fffbeb] transition"
                    aria-label={`Opret booking ${dayKey} kl. ${time}`}
                  >
                    <div className="flex flex-col gap-1">
                      {slot.map((b) => (
                        <BookingCard
                          key={b.id}
                          booking={b}
                          compact
                          onClick={() => onSelect(b)}
                        />
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MonthView({
  focal,
  byDate,
  today,
  onOpenDay,
}: {
  focal: Date
  byDate: Map<string, CalendarBooking[]>
  today: string
  onOpenDay: (dateKey: string) => void
}) {
  const firstOfMonth = new Date(focal.getFullYear(), focal.getMonth(), 1)
  const gridStart = startOfWeekMonday(firstOfMonth)
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const totalInMonth = cells.reduce((acc, d) => {
    if (d.getMonth() !== focal.getMonth()) return acc
    return acc + (byDate.get(toDateKey(d))?.length ?? 0)
  }, 0)

  return (
    <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
      {totalInMonth === 0 && (
        <div className="border-b border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-center text-xs text-[#6b7280]">
          Ingen bookinger denne måned
        </div>
      )}
      <div className="grid grid-cols-7 border-b border-[#e5e7eb] bg-[#f9fafb]">
        {WEEKDAYS_SHORT.map((w) => (
          <div
            key={w}
            className="px-2 py-2 text-center text-xs font-medium uppercase text-[#6b7280]"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, idx) => {
          const key = toDateKey(d)
          const dayBookings = byDate.get(key) ?? []
          const hasPending = dayBookings.some((b) => b.status === 'pending')
          const inMonth = d.getMonth() === focal.getMonth()
          const isToday = key === today
          const extra = Math.max(0, dayBookings.length - 2)
          const rowIdx = Math.floor(idx / 7)

          return (
            <button
              key={key}
              type="button"
              onClick={() => onOpenDay(key)}
              className={`min-h-28 border-l border-[#e5e7eb] px-2 py-1.5 text-left transition hover:bg-[#fffbeb] ${
                rowIdx > 0 ? 'border-t' : ''
              } ${!inMonth ? 'bg-[#f9fafb]' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isToday
                      ? 'bg-[#f59e0b] text-white'
                      : inMonth
                        ? 'text-[#111827]'
                        : 'text-[#9ca3af]'
                  }`}
                >
                  {d.getDate()}
                </div>
                <div className="flex items-center gap-1">
                  {hasPending && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-[#f59e0b]"
                      aria-label="Har afventende bookinger"
                    />
                  )}
                  {dayBookings.length > 0 && (
                    <span className="rounded-full bg-[#f3f4f6] px-1.5 py-0.5 text-[10px] font-medium text-[#6b7280]">
                      {dayBookings.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-1 space-y-0.5">
                {dayBookings.slice(0, 2).map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-1 truncate text-[11px]"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusMeta[b.status].dot}`}
                    />
                    <span className="truncate text-[#111827]">
                      {formatTime(b.booking_time)} {b.guest_name}
                    </span>
                  </div>
                ))}
                {extra > 0 && (
                  <div className="text-[11px] text-[#6b7280]">+{extra} flere</div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BookingCard({
  booking,
  compact = false,
  onClick,
}: {
  booking: CalendarBooking
  compact?: boolean
  onClick: () => void
}) {
  const meta = statusMeta[booking.status]
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onClick()
        }
      }}
      className={`block cursor-pointer rounded border px-2 py-1 text-xs transition hover:shadow-sm ${meta.card}`}
    >
      <div className="flex items-center gap-1.5 font-semibold">
        <span>{formatTime(booking.booking_time)}</span>
        <span className="truncate">{booking.guest_name}</span>
      </div>
      {!compact && (
        <div className="mt-0.5 flex items-center gap-2 text-[11px] opacity-80">
          <span className="inline-flex items-center gap-1">
            <Users size={10} />
            {booking.party_size}
          </span>
          <span>
            {booking.table_number !== null
              ? `Bord ${booking.table_number}`
              : 'Intet bord'}
          </span>
        </div>
      )}
    </span>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-[#e5e7eb] bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-3">
          <h2 className="text-base font-semibold text-[#111827]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827] transition"
            aria-label="Luk"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function CreateModal({
  tables,
  draft,
  pending,
  onSubmit,
  onClose,
}: {
  tables: TableOption[]
  draft: CreateDraft
  pending: boolean
  onSubmit: (formData: FormData) => void
  onClose: () => void
}) {
  return (
    <Modal title="Ny booking" onClose={onClose}>
      <form action={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Gæstenavn" htmlFor="guest_name">
          <input
            id="guest_name"
            name="guest_name"
            type="text"
            required
            className={inputClass}
          />
        </Field>
        <Field label="Antal personer" htmlFor="party_size">
          <input
            id="party_size"
            name="party_size"
            type="number"
            min={1}
            step={1}
            defaultValue={2}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Dato" htmlFor="booking_date">
          <input
            id="booking_date"
            name="booking_date"
            type="date"
            defaultValue={draft.date}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Tid" htmlFor="booking_time">
          <input
            id="booking_time"
            name="booking_time"
            type="time"
            defaultValue={draft.time}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Bord" htmlFor="table_id">
          <select
            id="table_id"
            name="table_id"
            defaultValue=""
            className={inputClass}
          >
            <option value="">Intet bord</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                Bord {t.table_number} ({t.capacity} pladser)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Telefon" htmlFor="guest_phone">
          <input
            id="guest_phone"
            name="guest_phone"
            type="tel"
            className={inputClass}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Noter" htmlFor="notes">
            <textarea
              id="notes"
              name="notes"
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </Field>
        </div>

        <div className="sm:col-span-2 mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#111827] hover:border-[#111827] transition"
          >
            Annuller
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[#f59e0b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d97706] transition disabled:opacity-50"
          >
            {pending ? 'Opretter…' : 'Opret booking'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DetailModal({
  booking,
  pending,
  onStatus,
  onClose,
}: {
  booking: CalendarBooking
  pending: boolean
  onStatus: (id: string, status: BookingStatus) => void
  onClose: () => void
}) {
  const meta = statusMeta[booking.status]
  const date = parseDateKey(booking.booking_date)
  const weekday = WEEKDAYS_LONG[(date.getDay() + 6) % 7]

  return (
    <Modal title={booking.guest_name} onClose={onClose}>
      <div className="space-y-3 text-sm text-[#111827]">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}
        >
          {meta.label}
        </span>

        <div className="flex items-center gap-2 text-[#6b7280]">
          <Clock size={14} />
          <span className="capitalize">{weekday}</span>{' '}
          {date.getDate()}. {MONTHS_DA[date.getMonth()]} · {formatTime(booking.booking_time)}
        </div>

        <div className="flex items-center gap-2 text-[#6b7280]">
          <Users size={14} />
          {booking.party_size} pers. ·{' '}
          {booking.table_number !== null
            ? `Bord ${booking.table_number}`
            : 'Intet bord'}
        </div>

        {booking.guest_phone && (
          <div className="flex items-center gap-2 text-[#6b7280]">
            <Phone size={14} />
            {booking.guest_phone}
          </div>
        )}

        {booking.notes && (
          <p className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-xs italic text-[#6b7280]">
            {booking.notes}
          </p>
        )}
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        {booking.status === 'pending' && (
          <button
            type="button"
            onClick={() => onStatus(booking.id, 'confirmed')}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-lg bg-[#f59e0b] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#d97706] transition disabled:opacity-50"
          >
            <Check size={14} />
            Bekræft
          </button>
        )}
        <button
          type="button"
          onClick={() => onStatus(booking.id, 'cancelled')}
          disabled={pending}
          className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-sm font-medium text-[#111827] hover:border-[#b91c1c] hover:text-[#b91c1c] transition disabled:opacity-50"
        >
          Annuller
        </button>
      </div>
    </Modal>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs font-medium text-[#6b7280]"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[#f59e0b] focus:outline-none focus:ring-1 focus:ring-[#f59e0b]'
