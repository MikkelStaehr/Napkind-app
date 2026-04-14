'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import Link from 'next/link'
import {
  Accessibility,
  AlertTriangle,
  ChefHat,
  Clock,
  DoorOpen,
  Minus,
  Phone,
  Plus,
  Users,
  UserPlus,
  Wine,
  X,
} from 'lucide-react'
import type { RestaurantTable } from '@/app/types/database'
import type {
  FloorElement,
  TablePosition,
  TodayBooking,
  Zone,
} from '../tables/floor-plan'
import type { FloorElementType, ZoneColor } from '../tables/actions'
import { confirmBooking, cancelBooking, createWalkIn } from './actions'

const ALLERGY_KEYWORDS = [
  'allergi',
  'nødder',
  'nodder',
  'gluten',
  'laktose',
  'skaldyr',
  'æg',
  'aeg',
  'soja',
  'selleri',
  'sennep',
  'sesam',
]

const CELL_SIZE_MIN = 24
const MAX_PARTY_SIZE = 20

const ZONE_COLORS: Record<ZoneColor, { bg: string; border: string }> = {
  amber: { bg: 'rgba(254,243,199,0.25)', border: '#f59e0b' },
  green: { bg: 'rgba(209,250,229,0.25)', border: '#10b981' },
  blue: { bg: 'rgba(219,234,254,0.25)', border: '#3b82f6' },
  purple: { bg: 'rgba(237,233,254,0.25)', border: '#8b5cf6' },
  red: { bg: 'rgba(254,226,226,0.25)', border: '#ef4444' },
  gray: { bg: 'rgba(243,244,246,0.45)', border: '#6b7280' },
}

type ElementConfig = {
  label: string
  bg: string
  border: string
  borderStyle: 'solid' | 'dashed'
  textColor: string
  icon: typeof ChefHat | null
  edgeStripe?: boolean
}

const ELEMENT_CONFIGS: Record<FloorElementType, ElementConfig> = {
  kitchen: {
    label: 'Køkken',
    bg: '#334155',
    border: '#0f172a',
    borderStyle: 'solid',
    textColor: '#f8fafc',
    icon: ChefHat,
  },
  door: {
    label: 'Dør',
    bg: '#f9fafb',
    border: '#6b7280',
    borderStyle: 'dashed',
    textColor: '#374151',
    icon: DoorOpen,
  },
  bar: {
    label: 'Bar',
    bg: '#ede9fe',
    border: '#8b5cf6',
    borderStyle: 'solid',
    textColor: '#5b21b6',
    icon: Wine,
  },
  window: {
    label: 'Vindue',
    bg: 'transparent',
    border: '#0ea5e9',
    borderStyle: 'solid',
    textColor: '#075985',
    icon: null,
    edgeStripe: true,
  },
  wall: {
    label: 'Væg',
    bg: '#9ca3af',
    border: '#4b5563',
    borderStyle: 'solid',
    textColor: '#ffffff',
    icon: null,
  },
  toilet: {
    label: 'Toilet',
    bg: '#ccfbf1',
    border: '#14b8a6',
    borderStyle: 'solid',
    textColor: '#115e59',
    icon: Accessibility,
  },
}

function hasAllergy(notes: string | null): boolean {
  if (!notes) return false
  const lower = notes.toLowerCase()
  return ALLERGY_KEYWORDS.some((k) => lower.includes(k))
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

function formatClock(d: Date): string {
  return d
    .toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .replace('.', ':')
}

function formatDanishDate(d: Date): string {
  const s = new Intl.DateTimeFormat('da-DK', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

type BookingPhase = 'current' | 'upcoming' | 'past'

const CURRENT_WINDOW_BEFORE_MS = 30 * 60 * 1000 // 30 min into the past
const CURRENT_WINDOW_AFTER_MS = 90 * 60 * 1000 // 90 min into the future

function classifyBooking(b: TodayBooking, now: Date): BookingPhase {
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

type TableBookings = {
  current: TodayBooking | null
  upcoming: TodayBooking | null
}

function resolveTableBookings(
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

function overlaps(
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

type Suggestion = {
  table: RestaurantTable
  zoneName: string | null
  zonePriority: number
  upcomingTime: string | null
}

function findSuggestions(
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

export function FloorplanClient({
  restaurantName,
  tables,
  positions,
  zones,
  elements,
  bookings,
  today,
}: {
  restaurantName: string
  tables: RestaurantTable[]
  positions: TablePosition[]
  zones: Zone[]
  elements: FloorElement[]
  bookings: TodayBooking[]
  today: string
}) {
  const [currentFloor, setCurrentFloor] = useState(1)
  const [now, setNow] = useState(() => new Date())
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [partySize, setPartySize] = useState(2)
  const [walkInStep, setWalkInStep] = useState<'size' | 'picking' | 'confirming'>('size')
  const [chosenTable, setChosenTable] = useState<RestaurantTable | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestNotes, setGuestNotes] = useState('')
  const [mobileWalkInOpen, setMobileWalkInOpen] = useState(false)
  const [panelTab, setPanelTab] = useState<'walkin' | 'oversigt'>('walkin')

  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const w = el.clientWidth
      if (w > 0) setContainerWidth(w)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const tableById = useMemo(() => {
    const m = new Map<string, RestaurantTable>()
    for (const t of tables) m.set(t.id, t)
    return m
  }, [tables])

  const resolvedBookings = useMemo(
    () => resolveTableBookings(bookings, now),
    [bookings, now]
  )

  const overviewRows = useMemo(() => {
    const positionByTable = new Map<string, TablePosition>()
    for (const p of positions) positionByTable.set(p.table_id, p)

    const STATUS_RANK: Record<'optaget' | 'afventer' | 'ledig', number> = {
      optaget: 0,
      afventer: 1,
      ledig: 2,
    }

    return tables
      .filter((t) => t.is_active)
      .map((t) => {
        const resolved = resolvedBookings.get(t.id) ?? null
        const status: 'optaget' | 'afventer' | 'ledig' = resolved?.current
          ? resolved.current.status === 'pending'
            ? 'afventer'
            : 'optaget'
          : 'ledig'
        const pos = positionByTable.get(t.id)
        let zoneName: string | null = null
        let zonePriority = Number.POSITIVE_INFINITY
        if (pos) {
          for (const z of zones) {
            if (z.floor !== pos.floor) continue
            if (overlaps(pos, z) && z.priority < zonePriority) {
              zonePriority = z.priority
              zoneName = z.name
            }
          }
        }
        return {
          table: t,
          status,
          current: resolved?.current ?? null,
          upcoming: resolved?.upcoming ?? null,
          zoneName,
        }
      })
      .sort((a, b) => {
        if (a.status !== b.status) {
          return STATUS_RANK[a.status] - STATUS_RANK[b.status]
        }
        return a.table.table_number - b.table.table_number
      })
  }, [tables, positions, zones, resolvedBookings])

  const availableFloors = useMemo(() => {
    const set = new Set<number>([1])
    for (const p of positions) set.add(p.floor)
    for (const z of zones) set.add(z.floor)
    for (const e of elements) set.add(e.floor)
    return Array.from(set).sort((a, b) => a - b)
  }, [positions, zones, elements])

  const currentPositions = positions.filter((p) => p.floor === currentFloor)
  const currentZones = zones
    .filter((z) => z.floor === currentFloor)
    .slice()
    .sort((a, b) => a.priority - b.priority)
  const currentElements = elements.filter((e) => e.floor === currentFloor)

  const bounds = useMemo(() => {
    let maxX = 20
    let maxY = 15
    for (const item of [...currentPositions, ...currentZones, ...currentElements]) {
      maxX = Math.max(maxX, item.grid_x + item.width)
      maxY = Math.max(maxY, item.grid_y + item.height)
    }
    return { cols: maxX + 2, rows: maxY + 2 }
  }, [currentPositions, currentZones, currentElements])

  const cellSize = Math.max(CELL_SIZE_MIN, Math.floor(containerWidth / bounds.cols))
  const gridPxWidth = bounds.cols * cellSize
  const gridPxHeight = bounds.rows * cellSize

  const handleTableClick = (table: RestaurantTable, current: TodayBooking | null) => {
    if (current) {
      setSelectedTableId(table.id)
      return
    }
    setSelectedTableId(null)
    setChosenTable(table)
    setWalkInStep('confirming')
    setPanelTab('walkin')
    setMobileWalkInOpen(true)
  }

  const resetWalkIn = () => {
    setWalkInStep('size')
    setChosenTable(null)
    setGuestName('')
    setGuestPhone('')
    setGuestNotes('')
    setPartySize(2)
    setMobileWalkInOpen(false)
  }

  const suggestions = useMemo(() => {
    if (walkInStep !== 'picking') return []
    return findSuggestions(partySize, tables, positions, zones, resolvedBookings)
  }, [walkInStep, partySize, tables, positions, zones, resolvedBookings])

  const selectedResolved = selectedTableId
    ? resolvedBookings.get(selectedTableId) ?? null
    : null
  const selectedBooking =
    selectedResolved?.current ?? selectedResolved?.upcoming ?? null
  const selectedTable = selectedTableId ? tableById.get(selectedTableId) ?? null : null

  const handleConfirm = (bookingId: string) => {
    setError(null)
    startTransition(async () => {
      try {
        await confirmBooking(bookingId)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke bekræfte booking')
      }
    })
  }

  const handleCancel = (bookingId: string) => {
    setError(null)
    startTransition(async () => {
      try {
        await cancelBooking(bookingId)
        setSelectedTableId(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke annullere booking')
      }
    })
  }

  const renderPanel = (): React.ReactNode => {
    if (selectedTableId && selectedTable) {
      return (
        <DetailPanel
          table={selectedTable}
          booking={selectedBooking}
          pending={pending}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onClose={() => setSelectedTableId(null)}
        />
      )
    }
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-[#e5e7eb] px-3 py-2">
          <div className="inline-flex w-full rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-0.5">
            {(
              [
                { v: 'walkin', l: 'Walk-in' },
                { v: 'oversigt', l: 'Oversigt' },
              ] as { v: typeof panelTab; l: string }[]
            ).map((o) => {
              const active = o.v === panelTab
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setPanelTab(o.v)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'bg-[#f59e0b] text-white shadow-sm'
                      : 'text-[#6b7280] hover:text-[#111827]'
                  }`}
                >
                  {o.l}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {panelTab === 'walkin' ? (
            <WalkInPanel
              step={walkInStep}
              partySize={partySize}
              setPartySize={setPartySize}
              onFind={() => setWalkInStep('picking')}
              onBackToSize={() => {
                setWalkInStep('size')
                setChosenTable(null)
              }}
              suggestions={suggestions}
              onChoose={(t) => {
                setChosenTable(t)
                setWalkInStep('confirming')
              }}
              chosenTable={chosenTable}
              guestName={guestName}
              setGuestName={setGuestName}
              guestPhone={guestPhone}
              setGuestPhone={setGuestPhone}
              guestNotes={guestNotes}
              setGuestNotes={setGuestNotes}
              pending={pending}
              onSubmit={handleCreateWalkIn}
            />
          ) : (
            <OversigtList
              rows={overviewRows}
              onSelect={(tableId) => setSelectedTableId(tableId)}
            />
          )}
        </div>
      </div>
    )
  }

  const handleCreateWalkIn = () => {
    if (!chosenTable) return
    setError(null)
    startTransition(async () => {
      try {
        const hh = String(now.getHours()).padStart(2, '0')
        const mm = String(now.getMinutes()).padStart(2, '0')
        await createWalkIn({
          tableId: chosenTable.id,
          partySize,
          guestName,
          guestPhone,
          notes: guestNotes,
          bookingDate: today,
          bookingTime: `${hh}:${mm}`,
        })
        resetWalkIn()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke oprette walk-in')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f9fafb] text-[16px]">
      {/* Pulsing keyframe for allergy dot */}
      <style>{`
        @keyframes napkind-pulse {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 0.2; transform: scale(1.4); }
        }
      `}</style>

      <header className="flex h-14 shrink-0 items-center justify-between bg-[#0f172a] px-4 text-white">
        <div className="flex items-center gap-3">
          <span className="font-logo text-xl font-bold tracking-tight">Napkind</span>
          <span className="text-xs uppercase tracking-wide text-white/60">
            Restaurantvisning
          </span>
          <span className="hidden text-sm text-white/80 md:inline">· {restaurantName}</span>
        </div>

        <div className="flex items-center gap-2 text-sm tabular-nums text-white/90 sm:text-base">
          <Clock size={16} className="text-white/70" />
          <span className="hidden sm:inline">{formatDanishDate(now)} · </span>
          <span>{formatClock(now)}</span>
        </div>

        <div className="flex items-center gap-2">
          {availableFloors.length > 1 && (
            <div className="inline-flex rounded-lg border border-white/20 bg-white/5 p-0.5">
              {availableFloors.map((f) => {
                const active = f === currentFloor
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setCurrentFloor(f)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      active ? 'bg-[#f59e0b] text-white' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Etage {f}
                  </button>
                )
              })}
            </div>
          )}
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-4 text-sm font-medium text-white hover:bg-white/10 transition"
          >
            <X size={16} />
            Luk
          </Link>
        </div>
      </header>

      {error && (
        <div className="bg-[#fef2f2] px-4 py-2 text-sm text-[#b91c1c]">{error}</div>
      )}

      <div className="flex min-h-0 flex-1">
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-[#f9fafb] p-4"
          style={{ minWidth: 0 }}
        >
          <div
            className="relative mx-auto rounded-xl border border-[#e5e7eb] bg-white"
            style={{
              width: gridPxWidth,
              height: gridPxHeight,
              backgroundColor: '#fafafa',
              backgroundImage:
                cellSize >= 24
                  ? 'linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)'
                  : undefined,
              backgroundSize:
                cellSize >= 24 ? `${cellSize}px ${cellSize}px` : undefined,
              overflow: 'hidden',
            }}
          >
            {currentZones.map((z) => (
              <ZoneShape key={z.id} zone={z} cellSize={cellSize} />
            ))}
            {currentElements.map((el) => (
              <ElementShape key={el.id} element={el} cellSize={cellSize} />
            ))}
            {currentPositions.map((p) => {
              const t = tableById.get(p.table_id)
              if (!t) return null
              const resolved = resolvedBookings.get(p.table_id) ?? null
              return (
                <OpsTableCard
                  key={p.table_id}
                  position={p}
                  table={t}
                  current={resolved?.current ?? null}
                  upcoming={resolved?.upcoming ?? null}
                  cellSize={cellSize}
                  selected={selectedTableId === p.table_id}
                  onClick={() => handleTableClick(t, resolved?.current ?? null)}
                />
              )
            })}
          </div>
        </div>

        <aside className="hidden w-[280px] shrink-0 flex-col border-l border-[#e5e7eb] bg-white md:flex">
          {renderPanel()}
        </aside>
      </div>

      {/* Mobile-only floating + button */}
      {!selectedTableId && !mobileWalkInOpen && (
        <button
          type="button"
          onClick={() => setMobileWalkInOpen(true)}
          className="fixed bottom-5 right-5 z-[55] inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#f59e0b] text-white shadow-lg hover:bg-[#d97706] transition md:hidden"
          aria-label="Opret walk-in"
        >
          <Plus size={24} />
        </button>
      )}

      {/* Mobile-only bottom sheet */}
      <MobileSheet
        open={Boolean(selectedTableId || mobileWalkInOpen)}
        onClose={() => {
          setSelectedTableId(null)
          setMobileWalkInOpen(false)
        }}
      >
        {renderPanel()}
      </MobileSheet>
    </div>
  )
}

type OverviewRow = {
  table: RestaurantTable
  status: 'optaget' | 'afventer' | 'ledig'
  current: TodayBooking | null
  upcoming: TodayBooking | null
  zoneName: string | null
}

function OversigtList({
  rows,
  onSelect,
}: {
  rows: OverviewRow[]
  onSelect: (tableId: string) => void
}) {
  const statusDot: Record<OverviewRow['status'], string> = {
    optaget: 'bg-[#10b981]',
    afventer: 'bg-[#f59e0b]',
    ledig: 'bg-[#9ca3af]',
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-[#6b7280]">
        Ingen borde endnu
      </div>
    )
  }

  return (
    <ul className="h-full overflow-y-auto divide-y divide-[#e5e7eb]">
      {rows.map((r, i) => {
        const allergy = r.current ? hasAllergy(r.current.notes) : false
        const priority = r.table.priority
        return (
          <li key={r.table.id}>
            <button
              type="button"
              onClick={() => onSelect(r.table.id)}
              className={`flex min-h-12 w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#fffbeb] ${
                i % 2 === 1 ? 'bg-[#f9fafb]' : 'bg-white'
              }`}
            >
              <span
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${statusDot[r.status]}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[#111827]">
                    Bord {r.table.table_number}
                  </span>
                  <span className="rounded-full bg-[#f3f4f6] px-1.5 py-0.5 text-[10px] font-medium text-[#374151]">
                    {r.table.capacity} pers.
                  </span>
                  {typeof priority === 'number' && priority < 10 && (
                    <span className="rounded-full bg-[#ede9fe] px-1.5 py-0.5 text-[10px] font-medium text-[#5b21b6]">
                      Prio {priority}
                    </span>
                  )}
                  {allergy && <AlertTriangle size={12} className="text-[#b91c1c]" />}
                </div>

                {r.zoneName && (
                  <div className="mt-0.5 text-[11px] text-[#6b7280]">{r.zoneName}</div>
                )}

                {r.current ? (
                  <div className="mt-0.5 text-xs text-[#111827]">
                    <span className="font-medium">{r.current.guest_name}</span>{' '}
                    <span className="text-[#6b7280]">
                      · {formatTime(r.current.booking_time)}
                    </span>
                  </div>
                ) : (
                  <div className="mt-0.5 text-xs text-[#6b7280]">Ledig</div>
                )}

                {r.upcoming && !r.current && (
                  <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-[#b45309]">
                    <Clock size={10} />
                    Res. {formatTime(r.upcoming.booking_time)}
                  </div>
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function MobileSheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className={`fixed inset-0 z-[60] md:hidden ${
        open ? '' : 'pointer-events-none'
      }`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        className={`absolute inset-x-0 bottom-0 h-[60vh] overflow-hidden rounded-t-2xl bg-white shadow-xl transition-transform duration-300 ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center py-2">
          <div className="h-1.5 w-10 rounded-full bg-[#d1d5db]" />
        </div>
        <div className="flex h-[calc(60vh-1.5rem)] flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  )
}

function OpsTableCard({
  position,
  table,
  current,
  upcoming,
  cellSize,
  selected,
  onClick,
}: {
  position: TablePosition
  table: RestaurantTable
  current: TodayBooking | null
  upcoming: TodayBooking | null
  cellSize: number
  selected: boolean
  onClick: () => void
}) {
  const status: 'ledig' | 'afventer' | 'optaget' = current
    ? current.status === 'pending'
      ? 'afventer'
      : 'optaget'
    : 'ledig'

  const statusClasses: Record<typeof status, string> = {
    ledig: 'border-[#e5e7eb] bg-white text-[#111827]',
    afventer: 'border-[#f59e0b] bg-[#fef3c7] text-[#92400e]',
    optaget: 'border-[#10b981] bg-[#d1fae5] text-[#065f46]',
  }

  const statusBadge: Record<typeof status, { label: string; className: string }> = {
    ledig: { label: 'Ledig', className: 'bg-[#f3f4f6] text-[#6b7280]' },
    afventer: { label: 'Afventer', className: 'bg-[#fffbeb] text-[#b45309]' },
    optaget: { label: 'Optaget', className: 'bg-[#ecfdf5] text-[#047857]' },
  }

  const selectedRing = selected ? 'ring-2 ring-[#0ea5e9] ring-offset-1' : ''
  const allergy = current ? hasAllergy(current.notes) : false

  const numberFont = Math.max(11, Math.min(16, cellSize * 0.38))
  const nameFont = Math.max(9, Math.min(13, cellSize * 0.3))
  const badgeFont = Math.max(8, Math.min(11, cellSize * 0.25))
  const radius = Math.max(4, cellSize * 0.15)

  const tier: 'tiny' | 'compact' | 'full' =
    cellSize < 28 ? 'tiny' : cellSize < 44 ? 'compact' : 'full'

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`absolute z-30 flex cursor-pointer flex-col overflow-hidden border-2 p-1.5 transition ${statusClasses[status]} ${selectedRing}`}
      style={{
        left: position.grid_x * cellSize,
        top: position.grid_y * cellSize,
        width: position.width * cellSize,
        height: position.height * cellSize,
        borderRadius: radius,
      }}
    >
      {allergy && (
        <span
          className="absolute right-1 top-1 rounded-full bg-[#ef4444]"
          style={{
            width: 8,
            height: 8,
            animation: 'napkind-pulse 1.2s ease-in-out infinite',
          }}
          aria-label="Allergi"
        />
      )}

      {tier === 'tiny' ? (
        <div className="flex h-full flex-col items-center justify-center">
          <span className="font-bold leading-none" style={{ fontSize: numberFont }}>
            {table.table_number}
          </span>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-1">
            <div className="font-bold leading-tight" style={{ fontSize: numberFont }}>
              Bord {table.table_number}
            </div>
            <div
              className="shrink-0 rounded-full bg-white/70 px-1.5 py-0.5 font-medium text-[#374151]"
              style={{ fontSize: badgeFont }}
            >
              {table.capacity} pers.
            </div>
          </div>

          {current ? (
            <div className="mt-1 min-w-0 flex-1">
              <div className="truncate font-semibold" style={{ fontSize: nameFont }}>
                {current.guest_name}
              </div>
              {tier === 'full' && (
                <>
                  <div className="mt-0.5 text-[11px] opacity-80">
                    {formatTime(current.booking_time)} · {current.party_size} pers.
                  </div>
                  {current.notes && (
                    <div
                      className="mt-0.5 flex items-center gap-1 truncate italic"
                      style={{ fontSize: badgeFont, color: allergy ? '#b91c1c' : '#6b7280' }}
                    >
                      {allergy && <AlertTriangle size={10} className="shrink-0" />}
                      {current.notes}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : upcoming ? (
            <div className="mt-1 text-[11px] text-[#9ca3af]">Ledig</div>
          ) : (
            <div className="mt-1 text-[11px] text-[#9ca3af]">Ledig</div>
          )}

          <div className="mt-auto flex items-center justify-between gap-1">
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 font-medium ${statusBadge[status].className}`}
              style={{ fontSize: badgeFont }}
            >
              {statusBadge[status].label}
            </span>
            {!current && upcoming && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-[#fffbeb] px-1.5 py-0.5 font-medium text-[#b45309]"
                style={{ fontSize: badgeFont }}
              >
                <Clock size={10} />
                Res. {formatTime(upcoming.booking_time)}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ZoneShape({ zone, cellSize }: { zone: Zone; cellSize: number }) {
  const cfg = ZONE_COLORS[zone.color]
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md border-2"
      style={{
        left: zone.grid_x * cellSize,
        top: zone.grid_y * cellSize,
        width: zone.width * cellSize,
        height: zone.height * cellSize,
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
      }}
    >
      <div className="absolute left-1 top-1">
        <span className="rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold text-[#111827] shadow-sm">
          {zone.name}
        </span>
      </div>
    </div>
  )
}

function ElementShape({
  element,
  cellSize,
}: {
  element: FloorElement
  cellSize: number
}) {
  const cfg = ELEMENT_CONFIGS[element.type]
  const Icon = cfg.icon
  const isWindow = !!cfg.edgeStripe
  const rotation = ((element.rotation % 360) + 360) % 360
  const stripeVertical = isWindow && (rotation === 90 || rotation === 270)
  const iconSize = Math.max(10, Math.min(18, cellSize * 0.4))

  return (
    <div
      className="pointer-events-none absolute z-20 rounded-md"
      style={{
        left: element.grid_x * cellSize,
        top: element.grid_y * cellSize,
        width: element.width * cellSize,
        height: element.height * cellSize,
        backgroundColor: isWindow ? 'transparent' : cfg.bg,
        border: isWindow ? 'none' : `2px ${cfg.borderStyle} ${cfg.border}`,
        color: cfg.textColor,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1"
        style={{
          transform: isWindow ? undefined : `rotate(${rotation}deg)`,
          transformOrigin: 'center',
        }}
      >
        {isWindow ? (
          <div
            style={{
              width: stripeVertical ? 4 : '100%',
              height: stripeVertical ? '100%' : 4,
              backgroundColor: cfg.border,
              borderRadius: 2,
            }}
          />
        ) : (
          <>
            {Icon && <Icon size={iconSize} />}
            <span
              className="font-semibold"
              style={{ fontSize: Math.max(9, Math.min(13, cellSize * 0.25)) }}
            >
              {element.label ?? cfg.label}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

function WalkInPanel({
  step,
  partySize,
  setPartySize,
  onFind,
  onBackToSize,
  suggestions,
  onChoose,
  chosenTable,
  guestName,
  setGuestName,
  guestPhone,
  setGuestPhone,
  guestNotes,
  setGuestNotes,
  pending,
  onSubmit,
}: {
  step: 'size' | 'picking' | 'confirming'
  partySize: number
  setPartySize: (n: number) => void
  onFind: () => void
  onBackToSize: () => void
  suggestions: Suggestion[]
  onChoose: (t: RestaurantTable) => void
  chosenTable: RestaurantTable | null
  guestName: string
  setGuestName: (v: string) => void
  guestPhone: string
  setGuestPhone: (v: string) => void
  guestNotes: string
  setGuestNotes: (v: string) => void
  pending: boolean
  onSubmit: () => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-[#e5e7eb] px-4 py-3">
        <UserPlus size={18} className="text-[#f59e0b]" />
        <h2 className="text-base font-semibold text-[#111827]">Walk-in</h2>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {step === 'size' && (
          <div>
            <label className="block text-xs font-medium text-[#6b7280]">
              Antal personer
            </label>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPartySize(Math.max(1, partySize - 1))}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#111827] hover:border-[#111827] transition"
                aria-label="Færre"
              >
                <Minus size={16} />
              </button>
              <input
                type="number"
                min={1}
                max={MAX_PARTY_SIZE}
                value={partySize}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isFinite(v)) {
                    setPartySize(Math.max(1, Math.min(MAX_PARTY_SIZE, Math.floor(v))))
                  }
                }}
                className="h-11 flex-1 rounded-lg border border-[#e5e7eb] bg-white px-3 text-center text-lg font-semibold text-[#111827] focus:border-[#f59e0b] focus:outline-none focus:ring-1 focus:ring-[#f59e0b]"
              />
              <button
                type="button"
                onClick={() => setPartySize(Math.min(MAX_PARTY_SIZE, partySize + 1))}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#111827] hover:border-[#111827] transition"
                aria-label="Flere"
              >
                <Plus size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={onFind}
              className="mt-4 h-11 w-full rounded-lg bg-[#f59e0b] px-4 text-sm font-semibold text-white hover:bg-[#d97706] transition"
            >
              Find bord
            </button>
          </div>
        )}

        {step === 'picking' && (
          <div>
            <button
              type="button"
              onClick={onBackToSize}
              className="text-xs font-medium text-[#6b7280] hover:text-[#111827]"
            >
              ← Skift antal personer
            </button>

            <h3 className="mt-3 text-sm font-semibold text-[#111827]">
              Forslag til {partySize} pers.
            </h3>

            {suggestions.length === 0 ? (
              <div className="mt-3 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-3 text-sm text-[#b91c1c]">
                Ingen ledige borde med plads til {partySize} pers.
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {suggestions.map((s) => (
                  <li key={s.table.id}>
                    <div className="rounded-lg border border-[#e5e7eb] bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-[#111827]">
                            Bord {s.table.table_number}
                          </div>
                          <div className="mt-0.5 text-xs text-[#6b7280]">
                            {s.table.capacity} pers.
                            {s.zoneName && <span> · {s.zoneName}</span>}
                          </div>
                          {s.upcomingTime && (
                            <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#b91c1c]">
                              <Clock size={12} />
                              Optaget igen {s.upcomingTime}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onChoose(s.table)}
                          className="inline-flex h-9 items-center rounded-lg bg-[#f59e0b] px-3 text-xs font-semibold text-white hover:bg-[#d97706] transition"
                        >
                          Vælg
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {step === 'confirming' && chosenTable && (
          <div>
            <button
              type="button"
              onClick={onBackToSize}
              className="text-xs font-medium text-[#6b7280] hover:text-[#111827]"
            >
              ← Vælg andet bord
            </button>

            <div className="mt-3 rounded-lg border-2 border-[#10b981] bg-[#ecfdf5] p-3">
              <div className="text-sm font-semibold text-[#065f46]">
                Bord {chosenTable.table_number}
              </div>
              <div className="mt-0.5 text-xs text-[#065f46]/80">
                {chosenTable.capacity} pers. · {partySize} gæster
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#6b7280]">
                  Gæstenavn (valgfri)
                </span>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Walk-in"
                  className="h-11 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827] focus:border-[#f59e0b] focus:outline-none focus:ring-1 focus:ring-[#f59e0b]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#6b7280]">
                  Telefon (valgfri)
                </span>
                <input
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="h-11 w-full rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827] focus:border-[#f59e0b] focus:outline-none focus:ring-1 focus:ring-[#f59e0b]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#6b7280]">
                  Noter / allergier
                </span>
                <textarea
                  rows={2}
                  value={guestNotes}
                  onChange={(e) => setGuestNotes(e.target.value)}
                  className="w-full resize-none rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[#f59e0b] focus:outline-none focus:ring-1 focus:ring-[#f59e0b]"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={onSubmit}
              disabled={pending}
              className="mt-4 h-11 w-full rounded-lg bg-[#f59e0b] px-4 text-sm font-semibold text-white hover:bg-[#d97706] transition disabled:opacity-50"
            >
              {pending ? 'Opretter…' : 'Opret walk-in'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailPanel({
  table,
  booking,
  pending,
  onConfirm,
  onCancel,
  onClose,
}: {
  table: RestaurantTable
  booking: TodayBooking | null
  pending: boolean
  onConfirm: (bookingId: string) => void
  onCancel: (bookingId: string) => void
  onClose: () => void
}) {
  const allergy = booking ? hasAllergy(booking.notes) : false

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
        <h2 className="text-base font-semibold text-[#111827]">
          Bord {table.table_number}
        </h2>
        <button
          type="button"
          onClick={(e: ReactMouseEvent) => {
            e.stopPropagation()
            onClose()
          }}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white px-3 text-xs font-medium text-[#6b7280] hover:border-[#111827] hover:text-[#111827] transition"
        >
          <X size={14} />
          Luk
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex items-center gap-2 text-sm text-[#6b7280]">
          <Users size={14} />
          {table.capacity} pladser
        </div>

        {booking ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold text-[#111827]">
                  {booking.guest_name}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    booking.status === 'pending'
                      ? 'bg-[#fffbeb] text-[#b45309]'
                      : 'bg-[#ecfdf5] text-[#047857]'
                  }`}
                >
                  {booking.status === 'pending' ? 'Afventer' : 'Optaget'}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#6b7280]">
                <span className="inline-flex items-center gap-1">
                  <Clock size={14} />
                  {formatTime(booking.booking_time)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users size={14} />
                  {booking.party_size} pers.
                </span>
                {booking.guest_phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone size={14} />
                    {booking.guest_phone}
                  </span>
                )}
              </div>

              {booking.notes && (
                <div
                  className={`mt-3 flex items-start gap-2 rounded border px-3 py-2 text-xs italic ${
                    allergy
                      ? 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]'
                      : 'border-[#e5e7eb] bg-white text-[#6b7280]'
                  }`}
                >
                  {allergy && <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
                  {booking.notes}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {booking.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => onConfirm(booking.id)}
                  disabled={pending}
                  className="h-11 rounded-lg bg-[#f59e0b] px-4 text-sm font-semibold text-white hover:bg-[#d97706] transition disabled:opacity-50"
                >
                  Bekræft
                </button>
              )}
              <button
                type="button"
                onClick={() => onCancel(booking.id)}
                disabled={pending}
                className="h-11 rounded-lg border border-[#e5e7eb] bg-white px-4 text-sm font-medium text-[#111827] hover:border-[#b91c1c] hover:text-[#b91c1c] transition disabled:opacity-50"
              >
                Annuller booking
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#6b7280]">
            Ingen booking på dette bord i dag.
          </p>
        )}
      </div>
    </div>
  )
}
