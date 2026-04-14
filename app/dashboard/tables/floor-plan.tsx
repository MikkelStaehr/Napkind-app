'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import {
  Accessibility,
  AlertTriangle,
  Check,
  ChefHat,
  DoorOpen,
  Pencil,
  Phone,
  Plus,
  Ruler,
  Save,
  Trash2,
  Users,
  Wine,
  X,
} from 'lucide-react'
import type { RestaurantTable } from '@/app/types/database'
import {
  updateBookingStatus,
  type BookingStatus,
} from '../bookings/actions'
import {
  deleteFloorElement,
  deleteZone,
  saveFloorElements,
  saveTablePositions,
  saveZones,
  type FloorElementInput,
  type FloorElementType,
  type TablePositionInput,
  type ZoneColor,
  type ZoneInput,
} from './actions'

export type TablePosition = {
  table_id: string
  floor: number
  grid_x: number
  grid_y: number
  width: number
  height: number
}

export type Zone = {
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

export type FloorElement = {
  id: string
  type: FloorElementType
  floor: number
  grid_x: number
  grid_y: number
  width: number
  height: number
  label: string | null
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

const DEFAULT_DIMS: Dimensions = { lengthM: 20, widthM: 15, resolution: 0.5 }
const MIN_METERS = 4
const MAX_METERS = 100

type Resolution = 0.25 | 0.5 | 1
type Dimensions = { lengthM: number; widthM: number; resolution: Resolution }

function dimsToGrid(d: Dimensions): { cols: number; rows: number } {
  return {
    cols: Math.max(1, Math.round(d.lengthM / d.resolution)),
    rows: Math.max(1, Math.round(d.widthM / d.resolution)),
  }
}

function computeCellSize(containerWidth: number, cols: number): number {
  return Math.max(20, Math.floor(containerWidth / cols))
}

type ItemKind = 'table' | 'zone' | 'element'
type ItemRef = { kind: ItemKind; id: string }

const ZONE_COLORS: Record<ZoneColor, { bg: string; border: string; chip: string }> = {
  amber: {
    bg: 'rgba(254, 243, 199, 0.55)',
    border: '#f59e0b',
    chip: 'bg-[#f59e0b] text-white',
  },
  green: {
    bg: 'rgba(209, 250, 229, 0.55)',
    border: '#10b981',
    chip: 'bg-[#10b981] text-white',
  },
  blue: {
    bg: 'rgba(219, 234, 254, 0.55)',
    border: '#3b82f6',
    chip: 'bg-[#3b82f6] text-white',
  },
  purple: {
    bg: 'rgba(237, 233, 254, 0.55)',
    border: '#8b5cf6',
    chip: 'bg-[#8b5cf6] text-white',
  },
  red: {
    bg: 'rgba(254, 226, 226, 0.55)',
    border: '#ef4444',
    chip: 'bg-[#ef4444] text-white',
  },
  gray: {
    bg: 'rgba(243, 244, 246, 0.75)',
    border: '#6b7280',
    chip: 'bg-[#6b7280] text-white',
  },
}

const ZONE_COLOR_OPTIONS: ZoneColor[] = ['amber', 'green', 'blue', 'purple', 'red', 'gray']

type ElementConfig = {
  label: string
  menuLabel: string
  defaultSize: { w: number; h: number }
  bg: string
  border: string
  borderStyle: 'solid' | 'dashed'
  textColor: string
  icon: typeof ChefHat | null
}

const ELEMENT_CONFIGS: Record<FloorElementType, ElementConfig> = {
  kitchen: {
    label: 'Køkken',
    menuLabel: '🍳 Køkken',
    defaultSize: { w: 4, h: 3 },
    bg: '#334155',
    border: '#0f172a',
    borderStyle: 'solid',
    textColor: '#f8fafc',
    icon: ChefHat,
  },
  door: {
    label: 'Dør / Entre',
    menuLabel: '🚪 Dør/Entre',
    defaultSize: { w: 2, h: 1 },
    bg: '#f9fafb',
    border: '#6b7280',
    borderStyle: 'dashed',
    textColor: '#374151',
    icon: DoorOpen,
  },
  bar: {
    label: 'Bar',
    menuLabel: '🍸 Bar',
    defaultSize: { w: 4, h: 1 },
    bg: '#ede9fe',
    border: '#8b5cf6',
    borderStyle: 'solid',
    textColor: '#5b21b6',
    icon: Wine,
  },
  window: {
    label: 'Vindue',
    menuLabel: '🪟 Vindue',
    defaultSize: { w: 2, h: 1 },
    bg: '#e0f2fe',
    border: '#bae6fd',
    borderStyle: 'solid',
    textColor: '#075985',
    icon: null,
  },
  wall: {
    label: 'Væg',
    menuLabel: '🧱 Væg',
    defaultSize: { w: 4, h: 1 },
    bg: '#9ca3af',
    border: '#4b5563',
    borderStyle: 'solid',
    textColor: '#ffffff',
    icon: null,
  },
  toilet: {
    label: 'Toilet',
    menuLabel: '🚻 Toilet',
    defaultSize: { w: 2, h: 2 },
    bg: '#ccfbf1',
    border: '#14b8a6',
    borderStyle: 'solid',
    textColor: '#115e59',
    icon: Accessibility,
  },
}

function defaultSizeForCapacity(capacity: number): { w: number; h: number } {
  if (capacity <= 2) return { w: 2, h: 2 }
  if (capacity <= 4) return { w: 3, h: 2 }
  if (capacity <= 6) return { w: 4, h: 2 }
  return { w: 4, h: 3 }
}

function clampBox(
  p: { grid_x: number; grid_y: number; width: number; height: number },
  cols: number,
  rows: number
) {
  const width = Math.max(1, Math.min(cols, Math.floor(p.width)))
  const height = Math.max(1, Math.min(rows, Math.floor(p.height)))
  const grid_x = Math.max(0, Math.min(cols - width, Math.floor(p.grid_x)))
  const grid_y = Math.max(0, Math.min(rows - height, Math.floor(p.grid_y)))
  return { grid_x, grid_y, width, height }
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `tmp-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

function positionsToMap(list: TablePosition[]): Record<string, TablePosition> {
  const m: Record<string, TablePosition> = {}
  for (const p of list) m[p.table_id] = p
  return m
}

function zonesToMap(list: Zone[]): Record<string, Zone> {
  const m: Record<string, Zone> = {}
  for (const z of list) m[z.id] = z
  return m
}

function elementsToMap(list: FloorElement[]): Record<string, FloorElement> {
  const m: Record<string, FloorElement> = {}
  for (const e of list) m[e.id] = e
  return m
}

export function FloorPlan({
  tables,
  positions,
  zones,
  elements,
  todayBookings,
  restaurantId,
}: {
  tables: RestaurantTable[]
  positions: TablePosition[]
  zones: Zone[]
  elements: FloorElement[]
  todayBookings: TodayBooking[]
  restaurantId: string
}) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [dims, setDims] = useState<Dimensions>(DEFAULT_DIMS)
  const [dimModalOpen, setDimModalOpen] = useState(false)
  const [currentFloor, setCurrentFloor] = useState(1)
  const [extraFloors, setExtraFloors] = useState<number[]>([])
  const [localPositions, setLocalPositions] = useState(() => positionsToMap(positions))
  const [localZones, setLocalZones] = useState(() => zonesToMap(zones))
  const [localElements, setLocalElements] = useState(() => elementsToMap(elements))
  const [selectedItem, setSelectedItem] = useState<ItemRef | null>(null)
  const [draggedItem, setDraggedItem] = useState<ItemRef | null>(null)
  const [dragPreview, setDragPreview] = useState<{
    x: number
    y: number
    w: number
    h: number
  } | null>(null)
  const [viewDetailId, setViewDetailId] = useState<string | null>(null)
  const [zoneFormOpen, setZoneFormOpen] = useState(false)
  const [addElementMenuOpen, setAddElementMenuOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const gridRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const grabOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  useEffect(() => {
    if (mode === 'view') {
      setLocalPositions(positionsToMap(positions))
      setLocalZones(zonesToMap(zones))
      setLocalElements(elementsToMap(elements))
    }
  }, [positions, zones, elements, mode])

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const w = el.clientWidth
      if (w > 0) setContainerWidth(w)
    }
    measure()
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const key = `napkind_floor_dimensions_${restaurantId}`
    const raw = window.localStorage.getItem(key)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Partial<Dimensions>
      const lengthM = Number(parsed.lengthM)
      const widthM = Number(parsed.widthM)
      const resolution = parsed.resolution
      if (
        Number.isFinite(lengthM) &&
        lengthM >= MIN_METERS &&
        lengthM <= MAX_METERS &&
        Number.isFinite(widthM) &&
        widthM >= MIN_METERS &&
        widthM <= MAX_METERS &&
        (resolution === 0.25 || resolution === 0.5 || resolution === 1)
      ) {
        setDims({ lengthM, widthM, resolution })
      }
    } catch {}
  }, [restaurantId])

  const { cols, rows } = useMemo(() => dimsToGrid(dims), [dims])
  const [containerWidth, setContainerWidth] = useState(800)
  const cellSize = computeCellSize(containerWidth, cols)
  const gridPxWidth = cols * cellSize
  const gridPxHeight = rows * cellSize

  const handleSaveDims = (newDims: Dimensions) => {
    setDims(newDims)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        `napkind_floor_dimensions_${restaurantId}`,
        JSON.stringify(newDims)
      )
    }
    setDimModalOpen(false)
  }

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

  const positionsList = Object.values(localPositions)
  const zonesList = Object.values(localZones)
  const elementsList = Object.values(localElements)

  const availableFloors = useMemo(() => {
    const set = new Set<number>([1, currentFloor, ...extraFloors])
    for (const p of positionsList) set.add(p.floor)
    for (const z of zonesList) set.add(z.floor)
    for (const e of elementsList) set.add(e.floor)
    return Array.from(set).sort((a, b) => a - b)
  }, [positionsList, zonesList, elementsList, extraFloors, currentFloor])

  const placedOnAnyFloor = new Set(positionsList.map((p) => p.table_id))
  const unplaced = tables.filter((t) => !placedOnAnyFloor.has(t.id))

  const currentPositions = positionsList.filter((p) => p.floor === currentFloor)
  const currentZones = zonesList
    .filter((z) => z.floor === currentFloor)
    .sort((a, b) => a.priority - b.priority)
  const currentElements = elementsList.filter((e) => e.floor === currentFloor)

  const handleEnterEdit = () => {
    setMode('edit')
    setSelectedItem(null)
    setViewDetailId(null)
    setError(null)
  }

  const handleCancel = () => {
    setLocalPositions(positionsToMap(positions))
    setLocalZones(zonesToMap(zones))
    setLocalElements(elementsToMap(elements))
    setExtraFloors([])
    setSelectedItem(null)
    setError(null)
    setMode('view')
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const positionPayload: TablePositionInput[] = Object.values(localPositions).map((p) => ({
        table_id: p.table_id,
        floor: p.floor,
        grid_x: p.grid_x,
        grid_y: p.grid_y,
        width: p.width,
        height: p.height,
      }))
      const zonePayload: ZoneInput[] = Object.values(localZones).map((z) => ({
        id: z.id,
        name: z.name,
        priority: z.priority,
        color: z.color,
        floor: z.floor,
        grid_x: z.grid_x,
        grid_y: z.grid_y,
        width: z.width,
        height: z.height,
      }))
      const elementPayload: FloorElementInput[] = Object.values(localElements).map((e) => ({
        id: e.id,
        type: e.type,
        floor: e.floor,
        grid_x: e.grid_x,
        grid_y: e.grid_y,
        width: e.width,
        height: e.height,
        label: e.label,
      }))

      await Promise.all([
        saveTablePositions(positionPayload),
        saveZones(zonePayload),
        saveFloorElements(elementPayload),
      ])

      setExtraFloors([])
      setSelectedItem(null)
      setMode('view')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke gemme layout')
    } finally {
      setSaving(false)
    }
  }

  const handleAddFloor = () => {
    const maxFloor = availableFloors[availableFloors.length - 1] ?? 1
    const next = maxFloor + 1
    setExtraFloors((prev) => [...prev, next])
    setCurrentFloor(next)
  }

  const handleDeleteFloor = (floor: number) => {
    const hasContent =
      positionsList.some((p) => p.floor === floor) ||
      zonesList.some((z) => z.floor === floor) ||
      elementsList.some((e) => e.floor === floor)
    if (hasContent) {
      const ok = confirm(
        `Etage ${floor} indeholder placerede borde, zoner eller elementer. Slet alt indhold på denne etage?`
      )
      if (!ok) return
      setLocalPositions((prev) => {
        const next: typeof prev = {}
        for (const [k, v] of Object.entries(prev)) {
          if (v.floor !== floor) next[k] = v
        }
        return next
      })
      setLocalZones((prev) => {
        const next: typeof prev = {}
        for (const [k, v] of Object.entries(prev)) {
          if (v.floor !== floor) next[k] = v
        }
        return next
      })
      setLocalElements((prev) => {
        const next: typeof prev = {}
        for (const [k, v] of Object.entries(prev)) {
          if (v.floor !== floor) next[k] = v
        }
        return next
      })
    }
    setExtraFloors((prev) => prev.filter((f) => f !== floor))
    if (currentFloor === floor) {
      setCurrentFloor(1)
    }
  }

  const handleAddElement = (type: FloorElementType) => {
    const cfg = ELEMENT_CONFIGS[type]
    const id = newId()
    const box = clampBox(
      {
        grid_x: 0,
        grid_y: 0,
        width: cfg.defaultSize.w,
        height: cfg.defaultSize.h,
      },
      cols,
      rows
    )
    const el: FloorElement = {
      id,
      type,
      floor: currentFloor,
      ...box,
      label: null,
    }
    setLocalElements((prev) => ({ ...prev, [id]: el }))
    setSelectedItem({ kind: 'element', id })
    setAddElementMenuOpen(false)
  }

  const handleAddZone = (input: { name: string; priority: number; color: ZoneColor }) => {
    const id = newId()
    const box = clampBox({ grid_x: 0, grid_y: 0, width: 4, height: 4 }, cols, rows)
    const zone: Zone = {
      id,
      name: input.name,
      priority: input.priority,
      color: input.color,
      floor: currentFloor,
      ...box,
    }
    setLocalZones((prev) => ({ ...prev, [id]: zone }))
    setSelectedItem({ kind: 'zone', id })
    setZoneFormOpen(false)
  }

  const handleDeleteSelected = async () => {
    if (!selectedItem) return
    const { kind, id } = selectedItem
    if (kind === 'table') {
      const ok = confirm('Fjern bordet fra plantegningen?')
      if (!ok) return
      setLocalPositions((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setSelectedItem(null)
    } else if (kind === 'zone') {
      const ok = confirm('Slet denne zone?')
      if (!ok) return
      setLocalZones((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      try {
        await deleteZone(id)
      } catch {
        // zone may not yet be persisted (new id); ignore
      }
      setSelectedItem(null)
    } else {
      const ok = confirm('Slet dette element?')
      if (!ok) return
      setLocalElements((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      try {
        await deleteFloorElement(id)
      } catch {
        // not persisted yet
      }
      setSelectedItem(null)
    }
  }

  const getItemSize = (ref: ItemRef): { w: number; h: number } => {
    if (ref.kind === 'table') {
      const pos = localPositions[ref.id]
      if (pos) return { w: pos.width, h: pos.height }
      const table = tableById.get(ref.id)
      const cap = table?.capacity ?? 2
      return defaultSizeForCapacity(cap)
    }
    if (ref.kind === 'zone') {
      const z = localZones[ref.id]
      return z ? { w: z.width, h: z.height } : { w: 4, h: 4 }
    }
    const el = localElements[ref.id]
    return el ? { w: el.width, h: el.height } : { w: 2, h: 2 }
  }

  const handleDragStart = (
    ref: ItemRef,
    e: ReactDragEvent<HTMLDivElement>
  ) => {
    const rect = e.currentTarget.getBoundingClientRect()
    grabOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
    setDraggedItem(ref)
    e.dataTransfer.setData('text/plain', `${ref.kind}:${ref.id}`)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDragPreview(null)
    grabOffset.current = { x: 0, y: 0 }
  }

  const computeDropCell = (e: ReactDragEvent<HTMLDivElement>) => {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    const x = Math.floor(
      (e.clientX - grabOffset.current.x - rect.left) / cellSize
    )
    const y = Math.floor(
      (e.clientY - grabOffset.current.y - rect.top) / cellSize
    )
    return { x, y }
  }

  const handleGridDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (mode !== 'edit' || !draggedItem) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const cell = computeDropCell(e)
    if (!cell) return
    const { w, h } = getItemSize(draggedItem)
    const x = Math.max(0, Math.min(cols - w, cell.x))
    const y = Math.max(0, Math.min(rows - h, cell.y))
    setDragPreview({ x, y, w, h })
  }

  const handleGridDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    if (mode !== 'edit') return
    e.preventDefault()
    const data = e.dataTransfer.getData('text/plain')
    const [kindRaw, id] = data.split(':') as [ItemKind, string]
    const kind = kindRaw as ItemKind
    if (!id || !['table', 'zone', 'element'].includes(kind)) return

    const cell = computeDropCell(e)
    if (!cell) return

    if (kind === 'table') {
      const existing = localPositions[id]
      const table = tableById.get(id)
      const size = existing
        ? { w: existing.width, h: existing.height }
        : defaultSizeForCapacity(table?.capacity ?? 2)
      const box = clampBox(
        { grid_x: cell.x, grid_y: cell.y, width: size.w, height: size.h },
        cols,
        rows
      )
      setLocalPositions((prev) => ({
        ...prev,
        [id]: {
          table_id: id,
          floor: currentFloor,
          ...box,
        },
      }))
    } else if (kind === 'zone') {
      const existing = localZones[id]
      if (!existing) return
      const box = clampBox(
        {
          grid_x: cell.x,
          grid_y: cell.y,
          width: existing.width,
          height: existing.height,
        },
        cols,
        rows
      )
      setLocalZones((prev) => ({
        ...prev,
        [id]: { ...existing, ...box },
      }))
    } else {
      const existing = localElements[id]
      if (!existing) return
      const box = clampBox(
        {
          grid_x: cell.x,
          grid_y: cell.y,
          width: existing.width,
          height: existing.height,
        },
        cols,
        rows
      )
      setLocalElements((prev) => ({
        ...prev,
        [id]: { ...existing, ...box },
      }))
    }

    setDraggedItem(null)
    setDragPreview(null)
  }

  const handleResizeStart = (
    ref: ItemRef,
    e: ReactPointerEvent<HTMLDivElement>
  ) => {
    e.preventDefault()
    e.stopPropagation()
    let startW = 0
    let startH = 0
    let startGX = 0
    let startGY = 0
    if (ref.kind === 'table') {
      const p = localPositions[ref.id]
      if (!p) return
      startW = p.width
      startH = p.height
      startGX = p.grid_x
      startGY = p.grid_y
    } else if (ref.kind === 'zone') {
      const z = localZones[ref.id]
      if (!z) return
      startW = z.width
      startH = z.height
      startGX = z.grid_x
      startGY = z.grid_y
    } else {
      const el = localElements[ref.id]
      if (!el) return
      startW = el.width
      startH = el.height
      startGX = el.grid_x
      startGY = el.grid_y
    }
    const startX = e.clientX
    const startY = e.clientY

    const onMove = (ev: PointerEvent) => {
      const dx = Math.round((ev.clientX - startX) / cellSize)
      const dy = Math.round((ev.clientY - startY) / cellSize)
      const box = clampBox(
        {
          grid_x: startGX,
          grid_y: startGY,
          width: startW + dx,
          height: startH + dy,
        },
        cols,
        rows
      )
      if (ref.kind === 'table') {
        setLocalPositions((prev) => {
          const cur = prev[ref.id]
          if (!cur) return prev
          return { ...prev, [ref.id]: { ...cur, ...box } }
        })
      } else if (ref.kind === 'zone') {
        setLocalZones((prev) => {
          const cur = prev[ref.id]
          if (!cur) return prev
          return { ...prev, [ref.id]: { ...cur, ...box } }
        })
      } else {
        setLocalElements((prev) => {
          const cur = prev[ref.id]
          if (!cur) return prev
          return { ...prev, [ref.id]: { ...cur, ...box } }
        })
      }
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
        setViewDetailId(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke opdatere booking')
      }
    })
  }


  const detailTable = viewDetailId ? tableById.get(viewDetailId) ?? null : null
  const detailBooking = viewDetailId ? bookingByTableId.get(viewDetailId) ?? null : null

  const unplacedMsg = unplaced.length > 0
    ? `${unplaced.length} ${unplaced.length === 1 ? 'bord er' : 'borde er'} ikke placeret — gå til Rediger layout`
    : null

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
          {error}
        </div>
      )}

      <div className="mb-3">
        <button
          type="button"
          onClick={() => setDimModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-[#111827] hover:border-[#f59e0b] transition"
        >
          <Ruler size={12} />
          📐 Lokale: {dims.lengthM} × {dims.widthM} m ({cols}×{rows} celler)
        </button>
      </div>

      <FloorTabs
        floors={availableFloors}
        currentFloor={currentFloor}
        onSelect={setCurrentFloor}
        onAdd={mode === 'edit' ? handleAddFloor : null}
        onDelete={mode === 'edit' ? handleDeleteFloor : null}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[#6b7280]">
          {mode === 'edit'
            ? 'Træk borde, zoner og elementer på gridet. Klik for at vælge og ændre størrelse.'
            : unplacedMsg ?? 'Klik på et bord for at se dagens booking'}
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

      {mode === 'edit' && (
        <EditToolbar
          addElementMenuOpen={addElementMenuOpen}
          setAddElementMenuOpen={setAddElementMenuOpen}
          onAddElement={handleAddElement}
          onOpenZoneForm={() => setZoneFormOpen(true)}
          selectedItem={selectedItem}
          onDeleteSelected={handleDeleteSelected}
        />
      )}

      <div className="mt-4 flex gap-4">
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
                      onDragStart={(e) => handleDragStart({ kind: 'table', id: t.id }, e)}
                      onDragEnd={handleDragEnd}
                      className="flex cursor-grab items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-2.5 py-2 text-xs text-[#111827] hover:border-[#f59e0b] active:cursor-grabbing"
                    >
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

        <div
          ref={containerRef}
          className="flex-1 rounded-xl border border-[#e5e7eb] bg-white p-3"
          style={{
            width: '100%',
            minWidth: 0,
            overflowX: 'hidden',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 320px)',
          }}
        >
          <div
            ref={gridRef}
            onDragOver={mode === 'edit' ? handleGridDragOver : undefined}
            onDragLeave={() => setDragPreview(null)}
            onDrop={mode === 'edit' ? handleGridDrop : undefined}
            onClick={() => mode === 'edit' && setSelectedItem(null)}
            className="relative"
            style={{
              width: gridPxWidth,
              height: gridPxHeight,
              overflow: 'hidden',
              backgroundColor: '#fafafa',
              backgroundImage:
                'linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)',
              backgroundSize: `${cellSize}px ${cellSize}px`,
            }}
          >
            {/* Zones layer */}
            {currentZones.map((z) => (
              <ZoneShape
                key={z.id}
                zone={z}
                cellSize={cellSize}
                mode={mode}
                selected={selectedItem?.kind === 'zone' && selectedItem.id === z.id}
                dragging={draggedItem?.kind === 'zone' && draggedItem.id === z.id}
                onClick={(e) => {
                  if (mode !== 'edit') return
                  e.stopPropagation()
                  setSelectedItem({ kind: 'zone', id: z.id })
                }}
                onDragStart={(e) => handleDragStart({ kind: 'zone', id: z.id }, e)}
                onDragEnd={handleDragEnd}
                onResizeStart={(e) => handleResizeStart({ kind: 'zone', id: z.id }, e)}
              />
            ))}

            {/* Elements layer */}
            {currentElements.map((el) => (
              <ElementShape
                key={el.id}
                element={el}
                cellSize={cellSize}
                mode={mode}
                selected={selectedItem?.kind === 'element' && selectedItem.id === el.id}
                dragging={draggedItem?.kind === 'element' && draggedItem.id === el.id}
                onClick={(e) => {
                  if (mode !== 'edit') return
                  e.stopPropagation()
                  setSelectedItem({ kind: 'element', id: el.id })
                }}
                onDragStart={(e) => handleDragStart({ kind: 'element', id: el.id }, e)}
                onDragEnd={handleDragEnd}
                onResizeStart={(e) => handleResizeStart({ kind: 'element', id: el.id }, e)}
              />
            ))}

            {/* Table cards layer */}
            {currentPositions.map((p) => {
              const table = tableById.get(p.table_id)
              if (!table) return null
              const booking = bookingByTableId.get(p.table_id) ?? null
              const isSelected = selectedItem?.kind === 'table' && selectedItem.id === p.table_id
              const isDragging = draggedItem?.kind === 'table' && draggedItem.id === p.table_id

              return (
                <TableCard
                  key={p.table_id}
                  position={p}
                  table={table}
                  booking={booking}
                  cellSize={cellSize}
                  mode={mode}
                  selected={isSelected}
                  dragging={isDragging}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (mode === 'edit') {
                      setSelectedItem((cur) =>
                        cur?.kind === 'table' && cur.id === p.table_id
                          ? null
                          : { kind: 'table', id: p.table_id }
                      )
                    } else {
                      setViewDetailId(p.table_id)
                    }
                  }}
                  onDragStart={(e) => handleDragStart({ kind: 'table', id: p.table_id }, e)}
                  onDragEnd={handleDragEnd}
                  onResizeStart={(e) => handleResizeStart({ kind: 'table', id: p.table_id }, e)}
                />
              )
            })}

            {/* Drag preview */}
            {mode === 'edit' && dragPreview && (
              <div
                className="pointer-events-none absolute z-40 rounded-md border-2 border-dashed border-[#f59e0b] bg-[#fef3c7]/40"
                style={{
                  left: dragPreview.x * cellSize,
                  top: dragPreview.y * cellSize,
                  width: dragPreview.w * cellSize,
                  height: dragPreview.h * cellSize,
                }}
              />
            )}
          </div>
        </div>
      </div>

      {mode === 'view' && detailTable && viewDetailId && (
        <DetailModal
          table={detailTable}
          booking={detailBooking}
          pending={pending}
          onClose={() => setViewDetailId(null)}
          onStatus={handleBookingStatus}
        />
      )}

      {mode === 'edit' && zoneFormOpen && (
        <ZoneFormModal
          onClose={() => setZoneFormOpen(false)}
          onSubmit={handleAddZone}
        />
      )}

      {dimModalOpen && (
        <DimensionsModal
          initial={dims}
          containerWidth={containerWidth}
          items={[
            ...positionsList.map((p) => ({
              grid_x: p.grid_x,
              grid_y: p.grid_y,
              width: p.width,
              height: p.height,
            })),
            ...zonesList,
            ...elementsList,
          ]}
          onClose={() => setDimModalOpen(false)}
          onSave={handleSaveDims}
        />
      )}
    </div>
  )
}

function FloorTabs({
  floors,
  currentFloor,
  onSelect,
  onAdd,
  onDelete,
}: {
  floors: number[]
  currentFloor: number
  onSelect: (n: number) => void
  onAdd: (() => void) | null
  onDelete: ((n: number) => void) | null
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {floors.map((f) => {
        const active = f === currentFloor
        return (
          <div
            key={f}
            className={`group inline-flex items-center overflow-hidden rounded-lg border transition ${
              active ? 'border-[#f59e0b] bg-[#f59e0b]' : 'border-[#e5e7eb] bg-white'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(f)}
              className={`px-3 py-1.5 text-xs font-medium ${
                active ? 'text-white' : 'text-[#111827] hover:text-[#f59e0b]'
              }`}
            >
              Etage {f}
            </button>
            {onDelete && f !== 1 && active && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(f)
                }}
                className="h-full px-1.5 text-white/90 hover:text-white"
                aria-label={`Slet etage ${f}`}
              >
                <X size={12} />
              </button>
            )}
          </div>
        )
      })}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-[#6b7280] hover:border-[#f59e0b] hover:text-[#f59e0b] transition"
        >
          <Plus size={12} />
          Tilføj etage
        </button>
      )}
    </div>
  )
}

function EditToolbar({
  addElementMenuOpen,
  setAddElementMenuOpen,
  onAddElement,
  onOpenZoneForm,
  selectedItem,
  onDeleteSelected,
}: {
  addElementMenuOpen: boolean
  setAddElementMenuOpen: (v: boolean) => void
  onAddElement: (type: FloorElementType) => void
  onOpenZoneForm: () => void
  selectedItem: ItemRef | null
  onDeleteSelected: () => void
}) {
  const elementTypes: FloorElementType[] = [
    'door',
    'kitchen',
    'bar',
    'toilet',
    'window',
    'wall',
  ]

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <div className="relative">
        <button
          type="button"
          onClick={() => setAddElementMenuOpen(!addElementMenuOpen)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-[#111827] hover:border-[#f59e0b] transition"
        >
          <Plus size={12} />
          Tilføj element
        </button>
        {addElementMenuOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-1 w-48 rounded-lg border border-[#e5e7eb] bg-white shadow-lg"
            onMouseLeave={() => setAddElementMenuOpen(false)}
          >
            {elementTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onAddElement(t)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#111827] hover:bg-[#fef3c7] transition"
              >
                {ELEMENT_CONFIGS[t].menuLabel}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenZoneForm}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-[#111827] hover:border-[#f59e0b] transition"
      >
        <Plus size={12} />
        Tilføj zone
      </button>

      {selectedItem && (
        <button
          type="button"
          onClick={onDeleteSelected}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#fecaca] bg-white px-3 py-1.5 text-xs font-medium text-[#b91c1c] hover:bg-[#fef2f2] transition"
        >
          <Trash2 size={12} />
          Slet{' '}
          {selectedItem.kind === 'table'
            ? 'bord'
            : selectedItem.kind === 'zone'
              ? 'zone'
              : 'element'}
        </button>
      )}
    </div>
  )
}

function TableCard({
  position,
  table,
  booking,
  cellSize,
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
  cellSize: number
  mode: 'view' | 'edit'
  selected: boolean
  dragging: boolean
  onClick: (e: ReactMouseEvent) => void
  onDragStart: (e: ReactDragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
  onResizeStart: (e: ReactPointerEvent<HTMLDivElement>) => void
}) {
  let colorClasses = 'border-[#e5e7eb] bg-white hover:border-[#f59e0b] text-[#111827]'
  if (booking) {
    if (booking.status === 'pending') {
      colorClasses = 'border-[#f59e0b] bg-[#fef3c7] text-[#92400e] hover:border-[#d97706]'
    } else {
      colorClasses = 'border-[#10b981] bg-[#d1fae5] text-[#065f46] hover:border-[#059669]'
    }
  }

  const editRing = selected ? 'ring-2 ring-[#f59e0b] ring-offset-1' : ''
  const tier: 'tiny' | 'compact' | 'full' =
    cellSize < 25 ? 'tiny' : cellSize < 40 ? 'compact' : 'full'
  const showCardDetails = tier === 'full' && position.width >= 3 && position.height >= 2

  const dotColor = !booking
    ? '#d1d5db'
    : booking.status === 'pending'
      ? '#f59e0b'
      : '#10b981'

  const numberFont = Math.max(9, Math.min(14, cellSize * 0.35))
  const nameFont = Math.max(8, Math.min(12, cellSize * 0.28))
  const badgeFont = Math.max(7, Math.min(11, cellSize * 0.25))
  const noteFont = Math.max(7, Math.min(10, cellSize * 0.22))
  const cardRadius = Math.max(4, cellSize * 0.15)
  const dotSize = Math.max(4, cellSize * 0.12)

  return (
    <div
      draggable={mode === 'edit'}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`absolute z-30 flex flex-col overflow-hidden border-2 transition ${colorClasses} ${editRing} ${
        dragging ? 'opacity-50' : ''
      } ${mode === 'edit' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
        tier === 'tiny' ? 'p-0.5 items-center justify-center' : 'p-1.5'
      }`}
      style={{
        left: position.grid_x * cellSize,
        top: position.grid_y * cellSize,
        width: position.width * cellSize,
        height: position.height * cellSize,
        borderRadius: cardRadius,
      }}
    >
      {tier === 'tiny' ? (
        <div className="flex flex-col items-center gap-0.5">
          <span
            className="rounded-full"
            style={{
              backgroundColor: dotColor,
              width: dotSize,
              height: dotSize,
            }}
            aria-hidden
          />
          <span
            className="font-bold leading-none"
            style={{ fontSize: numberFont }}
          >
            {table.table_number}
          </span>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-1">
            <div
              className="font-bold leading-tight"
              style={{ fontSize: numberFont }}
            >
              Bord {table.table_number}
            </div>
            <div
              className="shrink-0 rounded-full bg-white/70 px-1.5 py-0.5 font-medium text-[#374151]"
              style={{ fontSize: badgeFont }}
            >
              {table.capacity} pers.
            </div>
          </div>

          {booking ? (
            <div className="mt-1 min-w-0 flex-1">
              <div
                className="truncate font-semibold"
                style={{ fontSize: nameFont }}
              >
                {tier === 'full'
                  ? `${booking.guest_name} · ${formatTime(booking.booking_time)}`
                  : booking.guest_name}
              </div>
              {showCardDetails && (
                <>
                  <div
                    className="mt-0.5 opacity-80"
                    style={{ fontSize: noteFont }}
                  >
                    {booking.party_size} pers.
                    {booking.status === 'pending' ? ' · afventer' : ' · bekræftet'}
                  </div>
                  {booking.notes && (
                    <div
                      className="mt-0.5 truncate italic text-[#b91c1c]"
                      style={{ fontSize: noteFont }}
                    >
                      {booking.notes}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : tier === 'full' ? (
            <div
              className="mt-1 text-[#9ca3af]"
              style={{ fontSize: nameFont }}
            >
              Ledig
            </div>
          ) : null}
        </>
      )}

      {mode === 'edit' && selected && (
        <div
          onPointerDown={onResizeStart}
          className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize border-r-2 border-b-2 border-[#f59e0b] bg-white"
          aria-label="Ændr størrelse"
        />
      )}
    </div>
  )
}

function ZoneShape({
  zone,
  cellSize,
  mode,
  selected,
  dragging,
  onClick,
  onDragStart,
  onDragEnd,
  onResizeStart,
}: {
  zone: Zone
  cellSize: number
  mode: 'view' | 'edit'
  selected: boolean
  dragging: boolean
  onClick: (e: ReactMouseEvent) => void
  onDragStart: (e: ReactDragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
  onResizeStart: (e: ReactPointerEvent<HTMLDivElement>) => void
}) {
  const cfg = ZONE_COLORS[zone.color]
  const editRing = selected ? 'ring-2 ring-[#f59e0b] ring-offset-1' : ''

  return (
    <div
      draggable={mode === 'edit'}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`absolute z-10 rounded-md border-2 transition ${editRing} ${
        dragging ? 'opacity-50' : ''
      } ${
        mode === 'edit'
          ? 'cursor-grab active:cursor-grabbing'
          : 'pointer-events-none'
      }`}
      style={{
        left: zone.grid_x * cellSize,
        top: zone.grid_y * cellSize,
        width: zone.width * cellSize,
        height: zone.height * cellSize,
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
      }}
    >
      <div className="pointer-events-none absolute left-1 top-1 flex items-center gap-1">
        <span className="rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold text-[#111827] shadow-sm">
          {zone.name}
        </span>
        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${cfg.chip}`}>
          Prio {zone.priority}
        </span>
      </div>

      {mode === 'edit' && selected && (
        <div
          onPointerDown={onResizeStart}
          className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize border-r-2 border-b-2 border-[#f59e0b] bg-white"
          aria-label="Ændr størrelse"
        />
      )}
    </div>
  )
}

function ElementShape({
  element,
  cellSize,
  mode,
  selected,
  dragging,
  onClick,
  onDragStart,
  onDragEnd,
  onResizeStart,
}: {
  element: FloorElement
  cellSize: number
  mode: 'view' | 'edit'
  selected: boolean
  dragging: boolean
  onClick: (e: ReactMouseEvent) => void
  onDragStart: (e: ReactDragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
  onResizeStart: (e: ReactPointerEvent<HTMLDivElement>) => void
}) {
  const cfg = ELEMENT_CONFIGS[element.type]
  const Icon = cfg.icon
  const editRing = selected ? 'ring-2 ring-[#f59e0b] ring-offset-1' : ''

  return (
    <div
      draggable={mode === 'edit'}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`absolute z-20 flex items-center justify-center gap-1 rounded-md transition ${editRing} ${
        dragging ? 'opacity-50' : ''
      } ${
        mode === 'edit'
          ? 'cursor-grab active:cursor-grabbing'
          : 'pointer-events-none'
      }`}
      style={{
        left: element.grid_x * cellSize,
        top: element.grid_y * cellSize,
        width: element.width * cellSize,
        height: element.height * cellSize,
        backgroundColor: cfg.bg,
        border: `2px ${cfg.borderStyle} ${cfg.border}`,
        color: cfg.textColor,
      }}
    >
      {Icon && <Icon size={16} />}
      <span className="text-[11px] font-semibold">{element.label ?? cfg.label}</span>
      {mode === 'edit' && selected && (
        <div
          onPointerDown={onResizeStart}
          className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize border-r-2 border-b-2 border-[#f59e0b] bg-white"
          aria-label="Ændr størrelse"
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

function ZoneFormModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (input: { name: string; priority: number; color: ZoneColor }) => void
}) {
  const [name, setName] = useState('')
  const [priority, setPriority] = useState(1)
  const [color, setColor] = useState<ZoneColor>('amber')
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setLocalError('Zonenavn er påkrævet')
      return
    }
    onSubmit({ name: trimmed, priority, color })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-[#e5e7eb] bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-3">
          <h2 className="text-base font-semibold text-[#111827]">Ny zone</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827] transition"
            aria-label="Luk"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {localError && (
            <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]">
              {localError}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-[#6b7280]">
              Navn
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
              className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[#f59e0b] focus:outline-none focus:ring-1 focus:ring-[#f59e0b]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#6b7280]">
              Prioritet (lavere tal = fyldes først)
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[#f59e0b] focus:outline-none focus:ring-1 focus:ring-[#f59e0b]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#6b7280]">
              Farve
            </label>
            <div className="flex flex-wrap gap-2">
              {ZONE_COLOR_OPTIONS.map((c) => {
                const cfg = ZONE_COLORS[c]
                const active = c === color
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-8 w-8 rounded-md border-2 transition ${
                      active ? 'ring-2 ring-[#f59e0b] ring-offset-1' : ''
                    }`}
                    style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
                    aria-label={c}
                  />
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#111827] hover:border-[#111827] transition"
            >
              Annuller
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#f59e0b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d97706] transition"
            >
              Tilføj zone
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DimensionsModal({
  initial,
  containerWidth,
  items,
  onClose,
  onSave,
}: {
  initial: Dimensions
  containerWidth: number
  items: { grid_x: number; grid_y: number; width: number; height: number }[]
  onClose: () => void
  onSave: (d: Dimensions) => void
}) {
  const [lengthM, setLengthM] = useState(initial.lengthM)
  const [widthM, setWidthM] = useState(initial.widthM)
  const [resolution, setResolution] = useState<Resolution>(initial.resolution)
  const [localError, setLocalError] = useState<string | null>(null)

  const draft: Dimensions = { lengthM, widthM, resolution }
  const { cols: newCols, rows: newRows } = dimsToGrid(draft)
  const estimatedCellSize = Math.max(1, Math.floor(containerWidth / newCols))
  const tooDense = estimatedCellSize < 20

  const clippedCount = items.reduce(
    (acc, it) =>
      it.grid_x + it.width > newCols || it.grid_y + it.height > newRows
        ? acc + 1
        : acc,
    0
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !Number.isFinite(lengthM) ||
      lengthM < MIN_METERS ||
      lengthM > MAX_METERS
    ) {
      setLocalError(`Længde skal være mellem ${MIN_METERS} og ${MAX_METERS} meter`)
      return
    }
    if (!Number.isFinite(widthM) || widthM < MIN_METERS || widthM > MAX_METERS) {
      setLocalError(`Bredde skal være mellem ${MIN_METERS} og ${MAX_METERS} meter`)
      return
    }
    onSave({ lengthM, widthM, resolution })
  }

  const inputClass =
    'w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[#f59e0b] focus:outline-none focus:ring-1 focus:ring-[#f59e0b]'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-[#e5e7eb] bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-3">
          <h2 className="text-base font-semibold text-[#111827]">
            Lokale dimensioner
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

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {localError && (
            <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]">
              {localError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#6b7280]">
                Længde (meter)
              </label>
              <input
                type="number"
                min={MIN_METERS}
                max={MAX_METERS}
                step="0.25"
                value={lengthM}
                onChange={(e) => setLengthM(Number(e.target.value))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#6b7280]">
                Bredde (meter)
              </label>
              <input
                type="number"
                min={MIN_METERS}
                max={MAX_METERS}
                step="0.25"
                value={widthM}
                onChange={(e) => setWidthM(Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#6b7280]">
              Opløsning
            </label>
            <select
              value={resolution}
              onChange={(e) =>
                setResolution(Number(e.target.value) as Resolution)
              }
              className={inputClass}
            >
              <option value={1}>Lav (1 m/celle)</option>
              <option value={0.5}>Normal (0,5 m/celle)</option>
              <option value={0.25}>Høj (0,25 m/celle)</option>
            </select>
          </div>

          <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-xs text-[#6b7280]">
            Dit grid bliver <strong className="text-[#111827]">{newCols} × {newRows}</strong> celler (ca. {estimatedCellSize}px per celle)
          </div>

          {tooDense && (
            <div className="flex items-start gap-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-xs text-[#b91c1c]">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                OBS: Opløsningen er for høj til skærmen — vælg lavere opløsning eller gør lokalet mindre.
              </span>
            </div>
          )}

          {clippedCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-[#fcd34d] bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e]">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                OBS: {clippedCount}{' '}
                {clippedCount === 1 ? 'element ligger' : 'elementer ligger'} uden for det nye grid og vil ikke være synlige.
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#111827] hover:border-[#111827] transition"
            >
              Annuller
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#f59e0b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d97706] transition"
            >
              Gem dimensioner
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
