'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  AlertTriangle,
  Check,
  Move,
  Pencil,
  Phone,
  Save,
  Users,
  X,
} from 'lucide-react'
import type { RestaurantTable } from '@/app/types/database'
import {
  updateBookingStatus,
  type BookingStatus,
} from '../bookings/actions'
import { saveTablePositions, type TablePositionInput } from './actions'

export type TablePosition = {
  table_id: string
  grid_x: number
  grid_y: number
  width: number
  height: number
}

export type TodayBooking = {
  id: string
  table_id: string
  guest_name: string
  guest_phone: string | null
  party_size: number
  booking_time: string
  status: 'pending' | 'confirmed'
  notes: string | null
}

const CELL_SIZE = 48
const GRID_SIZE = 20
const DND_TYPE = 'application/x-napkind-table'

type PositionMap = Record<string, TablePosition>

function positionsToMap(list: TablePosition[]): PositionMap {
  const m: PositionMap = {}
  for (const p of list) m[p.table_id] = p
  return m
}

function clampPosition(p: {
  grid_x: number
  grid_y: number
  width: number
  height: number
}): TablePosition {
  const width = Math.max(1, Math.min(GRID_SIZE, p.width))
  const height = Math.max(1, Math.min(GRID_SIZE, p.height))
  const grid_x = Math.max(0, Math.min(GRID_SIZE - width, p.grid_x))
  const grid_y = Math.max(0, Math.min(GRID_SIZE - height, p.grid_y))
  return { table_id: '', grid_x, grid_y, width, height }
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

export function FloorPlan({
  tables,
  positions,
  todayBookings,
}: {
  tables: RestaurantTable[]
  positions: TablePosition[]
  todayBookings: TodayBooking[]
}) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [localPositions, setLocalPositions] = useState<PositionMap>(() =>
    positionsToMap(positions)
  )
  const [editSelectedId, setEditSelectedId] = useState<string | null>(null)
  const [viewSelectedId, setViewSelectedId] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragPreview, setDragPreview] = useState<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const gridRef = useRef<HTMLDivElement>(null)
  const grabOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    if (mode === 'view') {
      setLocalPositions(positionsToMap(positions))
    }
  }, [positions, mode])

  const tableById = useMemo(() => {
    const m = new Map<string, RestaurantTable>()
    for (const t of tables) m.set(t.id, t)
    return m
  }, [tables])

  const bookingByTableId = useMemo(() => {
    const m = new Map<string, TodayBooking>()
    for (const b of todayBookings) {
      if (!m.has(b.table_id)) m.set(b.table_id, b)
    }
    return m
  }, [todayBookings])

  const placed = Object.values(localPositions)
  const placedIds = new Set(placed.map((p) => p.table_id))
  const unplaced = tables.filter((t) => !placedIds.has(t.id))

  const handleEnterEdit = () => {
    setEditSelectedId(null)
    setViewSelectedId(null)
    setError(null)
    setMode('edit')
  }

  const handleCancel = () => {
    setLocalPositions(positionsToMap(positions))
    setEditSelectedId(null)
    setError(null)
    setMode('view')
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload: TablePositionInput[] = placed.map((p) => ({
        table_id: p.table_id,
        grid_x: p.grid_x,
        grid_y: p.grid_y,
        width: p.width,
        height: p.height,
      }))
      await saveTablePositions(payload)
      setEditSelectedId(null)
      setMode('view')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke gemme layout')
    } finally {
      setSaving(false)
    }
  }

  const handleDragStart = (
    tableId: string,
    e: React.DragEvent<HTMLDivElement>
  ) => {
    const rect = e.currentTarget.getBoundingClientRect()
    grabOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
    setDraggedId(tableId)
    e.dataTransfer.setData(DND_TYPE, tableId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDragPreview(null)
    grabOffset.current = { x: 0, y: 0 }
  }

  const computeDropCell = (e: React.DragEvent<HTMLDivElement>) => {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    const x = Math.floor(
      (e.clientX - grabOffset.current.x - rect.left) / CELL_SIZE
    )
    const y = Math.floor(
      (e.clientY - grabOffset.current.y - rect.top) / CELL_SIZE
    )
    return { x, y }
  }

  const getDragSize = (id: string | null) => {
    if (!id) return { w: 2, h: 2 }
    const existing = localPositions[id]
    return existing
      ? { w: existing.width, h: existing.height }
      : { w: 2, h: 2 }
  }

  const handleGridDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const cell = computeDropCell(e)
    if (!cell) return
    const { w, h } = getDragSize(draggedId)
    const x = Math.max(0, Math.min(GRID_SIZE - w, cell.x))
    const y = Math.max(0, Math.min(GRID_SIZE - h, cell.y))
    setDragPreview({ x, y, w, h })
  }

  const handleGridDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const tableId = e.dataTransfer.getData(DND_TYPE) || draggedId
    if (!tableId) return
    const cell = computeDropCell(e)
    if (!cell) return
    const existing = localPositions[tableId]
    const w = existing?.width ?? 2
    const h = existing?.height ?? 2
    const clamped = clampPosition({
      grid_x: cell.x,
      grid_y: cell.y,
      width: w,
      height: h,
    })
    setLocalPositions((prev) => ({
      ...prev,
      [tableId]: {
        table_id: tableId,
        grid_x: clamped.grid_x,
        grid_y: clamped.grid_y,
        width: clamped.width,
        height: clamped.height,
      },
    }))
    setDraggedId(null)
    setDragPreview(null)
  }

  const handleResizeStart = (
    tableId: string,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const pos = localPositions[tableId]
    if (!pos) return
    const startX = e.clientX
    const startY = e.clientY
    const startW = pos.width
    const startH = pos.height

    const onMove = (ev: PointerEvent) => {
      const dx = Math.round((ev.clientX - startX) / CELL_SIZE)
      const dy = Math.round((ev.clientY - startY) / CELL_SIZE)
      setLocalPositions((prev) => {
        const current = prev[tableId]
        if (!current) return prev
        const clamped = clampPosition({
          grid_x: current.grid_x,
          grid_y: current.grid_y,
          width: startW + dx,
          height: startH + dy,
        })
        return {
          ...prev,
          [tableId]: {
            table_id: tableId,
            grid_x: clamped.grid_x,
            grid_y: clamped.grid_y,
            width: clamped.width,
            height: clamped.height,
          },
        }
      })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleBookingStatus = (bookingId: string, status: BookingStatus) => {
    setError(null)
    startTransition(async () => {
      try {
        await updateBookingStatus(bookingId, status)
        setViewSelectedId(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke opdatere booking')
      }
    })
  }

  const gridPx = GRID_SIZE * CELL_SIZE

  const viewBooking = viewSelectedId
    ? bookingByTableId.get(viewSelectedId) ?? null
    : null
  const viewTable = viewSelectedId ? tableById.get(viewSelectedId) ?? null : null

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[#6b7280]">
          {mode === 'edit'
            ? 'Træk borde fra siden ind på gridet. Klik et bord for at vælge og ændre størrelse.'
            : unplaced.length > 0
              ? `${unplaced.length} ${unplaced.length === 1 ? 'bord er' : 'borde er'} ikke placeret — gå til Rediger layout`
              : 'Klik på et bord for at se dagens booking'}
        </div>

        <div className="flex items-center gap-2">
          {mode === 'view' ? (
            <button
              type="button"
              onClick={handleEnterEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-sm font-medium text-[#111827] hover:border-[#f59e0b] hover:text-[#f59e0b] transition"
            >
              <Pencil size={14} />
              Rediger layout
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-sm font-medium text-[#111827] hover:border-[#111827] transition disabled:opacity-50"
              >
                Annuller
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#f59e0b] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#d97706] transition disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? 'Gemmer…' : 'Gem layout'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        {mode === 'edit' && (
          <aside className="w-48 shrink-0 rounded-xl border border-[#e5e7eb] bg-white p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
              Ikke placeret
            </h3>
            {unplaced.length === 0 ? (
              <p className="mt-2 text-xs text-[#6b7280]">Alle borde er placeret.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {unplaced.map((t) => (
                  <li key={t.id}>
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(t.id, e)}
                      onDragEnd={handleDragEnd}
                      className="flex cursor-grab items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-2.5 py-2 text-xs text-[#111827] hover:border-[#f59e0b] active:cursor-grabbing"
                    >
                      <Move size={12} className="text-[#9ca3af]" />
                      <div>
                        <div className="font-semibold">Bord {t.table_number}</div>
                        <div className="text-[10px] text-[#6b7280]">
                          {t.capacity} pladser
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}

        <div className="flex-1 overflow-auto rounded-xl border border-[#e5e7eb] bg-white p-3">
          <div
            ref={gridRef}
            onDragOver={mode === 'edit' ? handleGridDragOver : undefined}
            onDragLeave={() => setDragPreview(null)}
            onDrop={mode === 'edit' ? handleGridDrop : undefined}
            onClick={() => mode === 'edit' && setEditSelectedId(null)}
            className="relative"
            style={{
              width: gridPx,
              height: gridPx,
              backgroundColor: '#fafafa',
              backgroundImage:
                'linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)',
              backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
            }}
          >
            {mode === 'edit' && dragPreview && (
              <div
                className="pointer-events-none absolute rounded-md border-2 border-dashed border-[#f59e0b] bg-[#fef3c7]/40"
                style={{
                  left: dragPreview.x * CELL_SIZE,
                  top: dragPreview.y * CELL_SIZE,
                  width: dragPreview.w * CELL_SIZE,
                  height: dragPreview.h * CELL_SIZE,
                }}
              />
            )}

            {placed.map((p) => {
              const table = tableById.get(p.table_id)
              if (!table) return null
              const booking = bookingByTableId.get(p.table_id) ?? null
              const isEditSelected = editSelectedId === p.table_id
              const isDragging = draggedId === p.table_id

              return (
                <TableCard
                  key={p.table_id}
                  position={p}
                  table={table}
                  booking={booking}
                  mode={mode}
                  selected={isEditSelected}
                  dragging={isDragging}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (mode === 'edit') {
                      setEditSelectedId((cur) =>
                        cur === p.table_id ? null : p.table_id
                      )
                    } else {
                      setViewSelectedId(p.table_id)
                    }
                  }}
                  onDragStart={(e) => handleDragStart(p.table_id, e)}
                  onDragEnd={handleDragEnd}
                  onResizeStart={(e) => handleResizeStart(p.table_id, e)}
                />
              )
            })}
          </div>
        </div>
      </div>

      {mode === 'view' && viewTable && viewSelectedId && (
        <DetailModal
          table={viewTable}
          booking={viewBooking}
          pending={pending}
          onClose={() => setViewSelectedId(null)}
          onStatus={handleBookingStatus}
        />
      )}
    </div>
  )
}

function TableCard({
  position,
  table,
  booking,
  mode,
  selected,
  dragging,
  onClick,
  onDragStart,
  onDragEnd,
  onResizeStart,
}: {
  position: TablePosition
  table: RestaurantTable
  booking: TodayBooking | null
  mode: 'view' | 'edit'
  selected: boolean
  dragging: boolean
  onClick: (e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
  onResizeStart: (e: React.PointerEvent<HTMLDivElement>) => void
}) {
  let colorClasses =
    'border-[#e5e7eb] bg-white hover:border-[#f59e0b] text-[#111827]'
  if (booking) {
    if (booking.status === 'pending') {
      colorClasses = 'border-[#f59e0b] bg-[#fef3c7] text-[#92400e] hover:border-[#d97706]'
    } else {
      colorClasses = 'border-[#10b981] bg-[#d1fae5] text-[#065f46] hover:border-[#059669]'
    }
  }

  const editRing = selected
    ? 'ring-2 ring-[#f59e0b] ring-offset-1'
    : ''

  const showDetails =
    position.width >= 3 && position.height >= 2 && booking !== null

  return (
    <div
      draggable={mode === 'edit'}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`absolute flex flex-col overflow-hidden rounded-md border-2 p-1.5 text-xs transition ${colorClasses} ${editRing} ${
        dragging ? 'opacity-50' : ''
      } ${mode === 'edit' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      style={{
        left: position.grid_x * CELL_SIZE,
        top: position.grid_y * CELL_SIZE,
        width: position.width * CELL_SIZE,
        height: position.height * CELL_SIZE,
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="font-bold leading-tight">Bord {table.table_number}</div>
        <div className="shrink-0 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-[#374151]">
          {table.capacity} pers.
        </div>
      </div>

      {booking ? (
        <div className="mt-1 min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold">
            {booking.guest_name} · {formatTime(booking.booking_time)}
          </div>
          {showDetails && (
            <>
              <div className="mt-0.5 text-[10px] opacity-80">
                {booking.party_size} pers.
                {booking.status === 'pending' ? ' · afventer' : ' · bekræftet'}
              </div>
              {booking.notes && (
                <div className="mt-0.5 truncate text-[10px] italic text-[#b91c1c]">
                  {booking.notes}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="mt-1 text-[11px] text-[#9ca3af]">Ledig</div>
      )}

      {mode === 'edit' && selected && (
        <div
          onPointerDown={onResizeStart}
          className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize border-r-2 border-b-2 border-[#f59e0b] bg-white"
          aria-label="Ændr størrelse"
          title="Træk for at ændre størrelse"
        />
      )}
    </div>
  )
}

function DetailModal({
  table,
  booking,
  pending,
  onClose,
  onStatus,
}: {
  table: RestaurantTable
  booking: TodayBooking | null
  pending: boolean
  onClose: () => void
  onStatus: (bookingId: string, status: BookingStatus) => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[#e5e7eb] bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-3">
          <h2 className="text-base font-semibold text-[#111827]">
            Bord {table.table_number}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827] transition"
            aria-label="Luk"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 p-5 text-sm text-[#111827]">
          <div className="flex items-center gap-2 text-[#6b7280]">
            <Users size={14} />
            {table.capacity} pladser
          </div>

          {booking ? (
            <>
              <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#111827]">
                    {booking.guest_name}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      booking.status === 'pending'
                        ? 'bg-[#fffbeb] text-[#b45309]'
                        : 'bg-[#ecfdf5] text-[#047857]'
                    }`}
                  >
                    {booking.status === 'pending' ? 'Afventer' : 'Bekræftet'}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6b7280]">
                  <span>{formatTime(booking.booking_time)}</span>
                  <span className="inline-flex items-center gap-1">
                    <Users size={12} />
                    {booking.party_size} pers.
                  </span>
                  {booking.guest_phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={12} />
                      {booking.guest_phone}
                    </span>
                  )}
                </div>

                {booking.notes && (
                  <div className="mt-2 flex items-start gap-1.5 rounded border border-[#fecaca] bg-[#fef2f2] px-2 py-1.5 text-xs italic text-[#b91c1c]">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    {booking.notes}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
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
                  Annuller booking
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-[#6b7280]">
              Ingen booking på dette bord i dag.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
