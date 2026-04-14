'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Check,
  Clock,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import {
  createBooking,
  deleteBooking,
  updateBookingStatus,
  type BookingStatus,
} from './actions'

export type BookingRow = {
  id: string
  guest_name: string
  guest_email: string | null
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

type DateFilter = 'today' | 'tomorrow' | 'week' | 'all'
type StatusFilter = 'all' | BookingStatus

const statusMeta: Record<
  BookingStatus,
  { label: string; className: string; dot: string }
> = {
  pending: {
    label: 'Afventer',
    className: 'bg-[#fffbeb] text-[#b45309]',
    dot: 'bg-[#f59e0b]',
  },
  confirmed: {
    label: 'Bekræftet',
    className: 'bg-[#ecfdf5] text-[#047857]',
    dot: 'bg-[#10b981]',
  },
  cancelled: {
    label: 'Annulleret',
    className: 'bg-[#f3f4f6] text-[#6b7280]',
    dot: 'bg-[#9ca3af]',
  },
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function toDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function matchesDateFilter(bookingDate: string, filter: DateFilter): boolean {
  if (filter === 'all') return true
  const today = startOfDay(new Date())
  const todayKey = toDateKey(today)

  if (filter === 'today') return bookingDate === todayKey

  if (filter === 'tomorrow') {
    const t = new Date(today)
    t.setDate(t.getDate() + 1)
    return bookingDate === toDateKey(t)
  }

  if (filter === 'week') {
    const end = new Date(today)
    end.setDate(end.getDate() + 7)
    const b = startOfDay(new Date(bookingDate))
    return b.getTime() >= today.getTime() && b.getTime() < end.getTime()
  }

  return true
}

function formatDanishDate(dateStr: string): string {
  const d = new Date(dateStr)
  const today = startOfDay(new Date())
  const todayKey = toDateKey(today)
  if (dateStr === todayKey) return 'I dag'
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (dateStr === toDateKey(tomorrow)) return 'I morgen'
  return new Intl.DateTimeFormat('da-DK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d)
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

export function BookingsClient({
  bookings,
  tables,
}: {
  bookings: BookingRow[]
  tables: TableOption[]
}) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return bookings.filter((b) => {
      if (!matchesDateFilter(b.booking_date, dateFilter)) return false
      if (statusFilter !== 'all' && b.status !== statusFilter) return false
      if (q) {
        const hay = `${b.guest_name} ${b.guest_phone ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [bookings, dateFilter, statusFilter, search])

  const handleCreate = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      try {
        await createBooking(formData)
        setCreating(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke oprette booking')
      }
    })
  }

  const handleStatusChange = (id: string, status: BookingStatus) => {
    setError(null)
    setPendingId(id)
    startTransition(async () => {
      try {
        await updateBookingStatus(id, status)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke opdatere booking')
      } finally {
        setPendingId(null)
      }
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Slet denne annullerede booking permanent?')) return
    setError(null)
    setPendingId(id)
    startTransition(async () => {
      try {
        await deleteBooking(id)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke slette booking')
      } finally {
        setPendingId(null)
      }
    })
  }

  const showEmptyState = filtered.length === 0 && !creating

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPills
            options={[
              { value: 'today', label: 'I dag' },
              { value: 'tomorrow', label: 'I morgen' },
              { value: 'week', label: 'Denne uge' },
              { value: 'all', label: 'Alle' },
            ]}
            value={dateFilter}
            onChange={(v) => setDateFilter(v as DateFilter)}
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setError(null)
            setCreating(true)
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#f59e0b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d97706] transition"
        >
          <Plus size={16} />
          Ny booking
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterPills
          options={[
            { value: 'all', label: 'Alle' },
            { value: 'pending', label: 'Afventer' },
            { value: 'confirmed', label: 'Bekræftet' },
            { value: 'cancelled', label: 'Annulleret' },
          ]}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
        />

        <div className="relative sm:w-72">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]"
          />
          <input
            type="text"
            placeholder="Søg navn eller telefon"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#e5e7eb] bg-white pl-9 pr-3 py-2 text-sm text-[#111827] focus:border-[#f59e0b] focus:outline-none focus:ring-1 focus:ring-[#f59e0b]"
          />
        </div>
      </div>

      {creating && (
        <CreateForm
          tables={tables}
          pending={pending}
          onSubmit={handleCreate}
          onCancel={() => {
            setError(null)
            setCreating(false)
          }}
        />
      )}

      {showEmptyState ? (
        <div className="rounded-xl border border-dashed border-[#e5e7eb] bg-white px-6 py-12 text-center">
          <p className="text-sm text-[#6b7280]">
            {dateFilter === 'today'
              ? 'Ingen bookinger i dag'
              : 'Ingen bookinger matcher filtrene'}
          </p>
          {dateFilter === 'today' && !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#f59e0b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d97706] transition"
            >
              <Plus size={16} />
              Opret booking
            </button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-[#e5e7eb] overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
          {filtered.map((b) => {
            const meta = statusMeta[b.status]
            const isPending = pendingId === b.id && pending
            return (
              <li key={b.id} className="px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                      <span className="text-sm font-semibold text-[#111827]">
                        {b.guest_name}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-[#6b7280]">
                        <Users size={12} />
                        {b.party_size} pers.
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6b7280]">
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {formatDanishDate(b.booking_date)} ·{' '}
                        {formatTime(b.booking_time)}
                      </span>
                      <span>
                        {b.table_number !== null
                          ? `Bord ${b.table_number}`
                          : 'Intet bord'}
                      </span>
                      {b.guest_phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone size={12} />
                          {b.guest_phone}
                        </span>
                      )}
                      {b.guest_email && (
                        <span className="inline-flex items-center gap-1">
                          <Mail size={12} />
                          {b.guest_email}
                        </span>
                      )}
                    </div>

                    {b.notes && (
                      <p className="mt-2 text-xs italic text-[#9ca3af]">
                        {b.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {b.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(b.id, 'confirmed')}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#f59e0b] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#d97706] transition disabled:opacity-50"
                      >
                        <Check size={14} />
                        Bekræft
                      </button>
                    )}
                    {b.status !== 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(b.id, 'cancelled')}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-[#111827] hover:border-[#b91c1c] hover:text-[#b91c1c] transition disabled:opacity-50"
                      >
                        Annuller
                      </button>
                    )}
                    {b.status === 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => handleDelete(b.id)}
                        disabled={isPending}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6b7280] hover:bg-[#fef2f2] hover:text-[#b91c1c] transition disabled:opacity-50"
                        aria-label="Slet booking"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-[#e5e7eb] bg-white p-0.5">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              active
                ? 'bg-[#f59e0b] text-white'
                : 'text-[#6b7280] hover:text-[#111827]'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function CreateForm({
  tables,
  pending,
  onSubmit,
  onCancel,
}: {
  tables: TableOption[]
  pending: boolean
  onSubmit: (formData: FormData) => void
  onCancel: () => void
}) {
  const todayKey = toDateKey(new Date())

  return (
    <form
      action={onSubmit}
      className="mb-6 rounded-xl border border-[#e5e7eb] bg-white p-5"
    >
      <div className="flex items-start justify-between">
        <h2 className="text-base font-semibold text-[#111827]">Ny booking</h2>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827] transition"
          aria-label="Luk"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            defaultValue={todayKey}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Tid" htmlFor="booking_time">
          <input
            id="booking_time"
            name="booking_time"
            type="time"
            defaultValue="19:00"
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
          <Field label="Email" htmlFor="guest_email">
            <input
              id="guest_email"
              name="guest_email"
              type="email"
              className={inputClass}
            />
          </Field>
        </div>
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
      </div>

      <div className="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
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
