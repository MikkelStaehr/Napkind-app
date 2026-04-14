'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type DragEvent as ReactDragEvent,
} from 'react'
import {
  Accessibility,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChefHat,
  DoorOpen,
  Eraser,
  Minus,
  Pencil,
  Plus,
  RotateCw,
  Save,
  Trash2,
  Wine,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { RestaurantTable } from '@/app/types/database'
import {
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
  rotation: number
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

type Resolution = 0.5 | 1
type ShapeMode = 'rect' | 'draw'
type WizardStep = 1 | 2 | 3
type ItemRef = { kind: 'table' | 'zone' | 'element'; id: string }

const DRAW_COLS = 40
const DRAW_ROWS = 30
const DRAW_CELL = 20
const MIN_METERS = 4
const MAX_METERS = 100
const DRAW_MIN_CELLS = 10
const MIN_CELL_SIZE = 16

const ZONE_COLORS: Record<ZoneColor, { bg: string; border: string; chip: string }> = {
  amber: { bg: 'rgba(254,243,199,0.55)', border: '#f59e0b', chip: 'bg-[#f59e0b] text-white' },
  green: { bg: 'rgba(209,250,229,0.55)', border: '#10b981', chip: 'bg-[#10b981] text-white' },
  blue: { bg: 'rgba(219,234,254,0.55)', border: '#3b82f6', chip: 'bg-[#3b82f6] text-white' },
  purple: { bg: 'rgba(237,233,254,0.55)', border: '#8b5cf6', chip: 'bg-[#8b5cf6] text-white' },
  red: { bg: 'rgba(254,226,226,0.55)', border: '#ef4444', chip: 'bg-[#ef4444] text-white' },
  gray: { bg: 'rgba(243,244,246,0.75)', border: '#6b7280', chip: 'bg-[#6b7280] text-white' },
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
  edgeStripe?: boolean
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
    bg: 'transparent',
    border: '#0ea5e9',
    borderStyle: 'solid',
    textColor: '#075985',
    icon: null,
    edgeStripe: true,
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

const ELEMENT_ORDER: FloorElementType[] = ['door', 'kitchen', 'bar', 'window', 'wall', 'toilet']

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

function cellKey(x: number, y: number): string {
  return `${x},${y}`
}
function parseCellKey(k: string): { x: number; y: number } {
  const [x, y] = k.split(',').map(Number)
  return { x, y }
}

function computeShape(
  shapeMode: ShapeMode,
  lengthM: number,
  widthM: number,
  resolution: Resolution,
  activeCells: Set<string>
): { cols: number; rows: number; usable: (x: number, y: number) => boolean } {
  if (shapeMode === 'rect') {
    const cols = Math.max(1, Math.round(lengthM / resolution))
    const rows = Math.max(1, Math.round(widthM / resolution))
    return { cols, rows, usable: () => true }
  }
  if (activeCells.size === 0) {
    return { cols: 1, rows: 1, usable: () => false }
  }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const k of activeCells) {
    const { x, y } = parseCellKey(k)
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  const pad = 2
  const cols = maxX - minX + 1 + pad * 2
  const rows = maxY - minY + 1 + pad * 2
  const usableSet = new Set<string>()
  for (const k of activeCells) {
    const { x, y } = parseCellKey(k)
    usableSet.add(cellKey(x - minX + pad, y - minY + pad))
  }
  return {
    cols,
    rows,
    usable: (x, y) => usableSet.has(cellKey(x, y)),
  }
}

const STORAGE_KEY_PREFIX = 'napkind_floorplan_'

type PersistedShape = {
  shapeMode: ShapeMode
  lengthM: number
  widthM: number
  resolution: Resolution
  activeCells: string[]
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
  const hasLayout = positions.length > 0 || zones.length > 0 || elements.length > 0
  const [mode, setMode] = useState<'view' | 'wizard'>(hasLayout ? 'view' : 'wizard')
  const [step, setStep] = useState<WizardStep>(1)

  const [shapeMode, setShapeMode] = useState<ShapeMode>('rect')
  const [lengthM, setLengthM] = useState(20)
  const [widthM, setWidthM] = useState(15)
  const [resolution, setResolution] = useState<Resolution>(0.5)
  const [activeCells, setActiveCells] = useState<Set<string>>(new Set())

  const [localPositions, setLocalPositions] = useState(() => positionsToMap(positions))
  const [localZones, setLocalZones] = useState(() => zonesToMap(zones))
  const [localElements, setLocalElements] = useState(() => elementsToMap(elements))

  const [currentFloor, setCurrentFloor] = useState(1)
  const [extraFloors, setExtraFloors] = useState<number[]>([])

  const [selectedItem, setSelectedItem] = useState<ItemRef | null>(null)
  const [placementType, setPlacementType] = useState<FloorElementType | null>(null)
  const [zoneFormOpen, setZoneFormOpen] = useState(false)
  const [pendingZone, setPendingZone] = useState<{ name: string; priority: number; color: ZoneColor } | null>(null)
  const [zoneDrawing, setZoneDrawing] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null)

  const [draggedItem, setDraggedItem] = useState<ItemRef | null>(null)
  const [dragPreview, setDragPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const [viewDetailId, setViewDetailId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [containerWidth, setContainerWidth] = useState(800)
  const [zoom, setZoomRaw] = useState(1)
  const setZoom = (z: number) => {
    const clamped = Math.max(0.5, Math.min(2, Math.round(z * 10) / 10))
    setZoomRaw(clamped)
  }
  const containerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + restaurantId)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as Partial<PersistedShape>
      if (parsed.shapeMode === 'rect' || parsed.shapeMode === 'draw') {
        setShapeMode(parsed.shapeMode)
      }
      if (
        typeof parsed.lengthM === 'number' &&
        parsed.lengthM >= MIN_METERS &&
        parsed.lengthM <= MAX_METERS
      ) {
        setLengthM(parsed.lengthM)
      }
      if (
        typeof parsed.widthM === 'number' &&
        parsed.widthM >= MIN_METERS &&
        parsed.widthM <= MAX_METERS
      ) {
        setWidthM(parsed.widthM)
      }
      if (parsed.resolution === 0.5 || parsed.resolution === 1) {
        setResolution(parsed.resolution)
      }
      if (Array.isArray(parsed.activeCells)) {
        setActiveCells(new Set(parsed.activeCells.filter((x) => typeof x === 'string')))
      }
    } catch {}
  }, [restaurantId])

  const persistShape = (next: Partial<PersistedShape>) => {
    if (typeof window === 'undefined') return
    const payload: PersistedShape = {
      shapeMode: next.shapeMode ?? shapeMode,
      lengthM: next.lengthM ?? lengthM,
      widthM: next.widthM ?? widthM,
      resolution: next.resolution ?? resolution,
      activeCells: next.activeCells ?? Array.from(activeCells),
    }
    window.localStorage.setItem(STORAGE_KEY_PREFIX + restaurantId, JSON.stringify(payload))
  }

  const { cols, rows, usable } = useMemo(
    () => computeShape(shapeMode, lengthM, widthM, resolution, activeCells),
    [shapeMode, lengthM, widthM, resolution, activeCells]
  )
  const cellSize = Math.max(MIN_CELL_SIZE, Math.floor(containerWidth / cols))
  const gridPxWidth = cols * cellSize
  const gridPxHeight = rows * cellSize

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

  const placedTableIds = new Set(positionsList.map((p) => p.table_id))
  const unplaced = tables.filter((t) => !placedTableIds.has(t.id))

  const currentPositions = positionsList.filter((p) => p.floor === currentFloor)
  const currentZones = zonesList
    .filter((z) => z.floor === currentFloor)
    .sort((a, b) => a.priority - b.priority)
  const currentElements = elementsList.filter((e) => e.floor === currentFloor)

  const openWizard = () => {
    setMode('wizard')
    setStep(1)
    setSelectedItem(null)
    setPlacementType(null)
    setError(null)
  }

  const cancelWizard = () => {
    setLocalPositions(positionsToMap(positions))
    setLocalZones(zonesToMap(zones))
    setLocalElements(elementsToMap(elements))
    setExtraFloors([])
    setSelectedItem(null)
    setPlacementType(null)
    setZoneFormOpen(false)
    setPendingZone(null)
    setError(null)
    setMode('view')
  }

  const step1Valid =
    shapeMode === 'rect'
      ? lengthM >= MIN_METERS &&
        lengthM <= MAX_METERS &&
        widthM >= MIN_METERS &&
        widthM <= MAX_METERS
      : activeCells.size >= DRAW_MIN_CELLS

  const goNext = () => {
    if (step === 1) {
      if (!step1Valid) return
      persistShape({})
      setStep(2)
    } else if (step === 2) {
      setPlacementType(null)
      setPendingZone(null)
      setSelectedItem(null)
      setStep(3)
    }
  }
  const goBack = () => {
    if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const posPayload: TablePositionInput[] = positionsList.map((p) => ({
        table_id: p.table_id,
        floor: p.floor,
        grid_x: p.grid_x,
        grid_y: p.grid_y,
        width: p.width,
        height: p.height,
      }))
      const zonePayload: ZoneInput[] = zonesList.map((z) => ({
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
      const elPayload: FloorElementInput[] = elementsList.map((e) => ({
        id: e.id,
        type: e.type,
        floor: e.floor,
        grid_x: e.grid_x,
        grid_y: e.grid_y,
        width: e.width,
        height: e.height,
        rotation: e.rotation,
        label: e.label,
      }))
      await Promise.all([
        saveTablePositions(posPayload),
        saveZones(zonePayload),
        saveFloorElements(elPayload),
      ])
      persistShape({})
      setSelectedItem(null)
      setExtraFloors([])
      setMode('view')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke gemme layout')
    } finally {
      setSaving(false)
    }
  }

  const handleRotateSelected = () => {
    if (!selectedItem || selectedItem.kind !== 'element') return
    const id = selectedItem.id
    setLocalElements((prev) => {
      const cur = prev[id]
      if (!cur) return prev
      return { ...prev, [id]: { ...cur, rotation: (cur.rotation + 90) % 360 } }
    })
  }

  const handleDeleteSelected = () => {
    if (!selectedItem) return
    const { kind, id } = selectedItem
    if (kind === 'table') {
      setLocalPositions((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } else if (kind === 'zone') {
      setLocalZones((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } else {
      setLocalElements((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
    setSelectedItem(null)
  }

  useEffect(() => {
    if (mode !== 'wizard') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' && selectedItem) {
        const target = e.target as HTMLElement | null
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          return
        }
        e.preventDefault()
        handleDeleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, selectedItem])

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
        `Etage ${floor} indeholder indhold. Slet alt på denne etage?`
      )
      if (!ok) return
      const removeByFloor = <T extends { floor: number }>(
        src: Record<string, T>
      ): Record<string, T> => {
        const next: Record<string, T> = {}
        for (const [k, v] of Object.entries(src)) {
          if (v.floor !== floor) next[k] = v
        }
        return next
      }
      setLocalPositions((prev) => removeByFloor(prev))
      setLocalZones((prev) => removeByFloor(prev))
      setLocalElements((prev) => removeByFloor(prev))
    }
    setExtraFloors((prev) => prev.filter((f) => f !== floor))
    if (currentFloor === floor) setCurrentFloor(1)
  }

  // Step 2 interactions ----------------------------------------------------

  const placeElementAtCell = (cx: number, cy: number) => {
    if (!placementType) return
    const cfg = ELEMENT_CONFIGS[placementType]
    const id = newId()
    const box = clampBox(
      { grid_x: cx, grid_y: cy, width: cfg.defaultSize.w, height: cfg.defaultSize.h },
      cols,
      rows
    )
    setLocalElements((prev) => ({
      ...prev,
      [id]: {
        id,
        type: placementType,
        floor: currentFloor,
        ...box,
        rotation: 0,
        label: null,
      },
    }))
    setSelectedItem({ kind: 'element', id })
    setPlacementType(null)
  }

  const beginZoneSubmit = (input: { name: string; priority: number; color: ZoneColor }) => {
    setPendingZone(input)
    setZoneFormOpen(false)
  }

  const finalizeZone = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    if (!pendingZone) return
    const x1 = Math.min(a.x, b.x)
    const y1 = Math.min(a.y, b.y)
    const x2 = Math.max(a.x, b.x)
    const y2 = Math.max(a.y, b.y)
    const box = clampBox(
      { grid_x: x1, grid_y: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 },
      cols,
      rows
    )
    const id = newId()
    const zone: Zone = {
      id,
      name: pendingZone.name,
      priority: pendingZone.priority,
      color: pendingZone.color,
      floor: currentFloor,
      ...box,
    }
    setLocalZones((prev) => ({ ...prev, [id]: zone }))
    setSelectedItem({ kind: 'zone', id })
    setPendingZone(null)
    setZoneDrawing(null)
  }

  // Shared drag/resize -----------------------------------------------------

  const getItemSize = (ref: ItemRef): { w: number; h: number } => {
    if (ref.kind === 'table') {
      const pos = localPositions[ref.id]
      if (pos) return { w: pos.width, h: pos.height }
      const t = tableById.get(ref.id)
      return defaultSizeForCapacity(t?.capacity ?? 2)
    }
    if (ref.kind === 'zone') {
      const z = localZones[ref.id]
      return z ? { w: z.width, h: z.height } : { w: 4, h: 4 }
    }
    const el = localElements[ref.id]
    return el ? { w: el.width, h: el.height } : { w: 2, h: 2 }
  }

  const handleItemDragStart = (ref: ItemRef, e: ReactDragEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    grabOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    setDraggedItem(ref)
    e.dataTransfer.setData('text/plain', `${ref.kind}:${ref.id}`)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleItemDragEnd = () => {
    setDraggedItem(null)
    setDragPreview(null)
    grabOffset.current = { x: 0, y: 0 }
  }

  const computeDropCell = (e: ReactDragEvent<HTMLDivElement>) => {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    const scaled = cellSize * zoom
    const x = Math.floor((e.clientX - grabOffset.current.x - rect.left) / scaled)
    const y = Math.floor((e.clientY - grabOffset.current.y - rect.top) / scaled)
    return { x, y }
  }

  const handleGridDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!draggedItem) return
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
    e.preventDefault()
    const data = e.dataTransfer.getData('text/plain')
    const [kindRaw, id] = data.split(':') as [ItemRef['kind'], string]
    if (!id) return
    const cell = computeDropCell(e)
    if (!cell) return
    if (kindRaw === 'table') {
      const existing = localPositions[id]
      const t = tableById.get(id)
      const size = existing
        ? { w: existing.width, h: existing.height }
        : defaultSizeForCapacity(t?.capacity ?? 2)
      const box = clampBox(
        { grid_x: cell.x, grid_y: cell.y, width: size.w, height: size.h },
        cols,
        rows
      )
      setLocalPositions((prev) => ({
        ...prev,
        [id]: { table_id: id, floor: currentFloor, ...box },
      }))
    } else if (kindRaw === 'zone') {
      const existing = localZones[id]
      if (!existing) return
      const box = clampBox(
        { grid_x: cell.x, grid_y: cell.y, width: existing.width, height: existing.height },
        cols,
        rows
      )
      setLocalZones((prev) => ({ ...prev, [id]: { ...existing, ...box } }))
    } else {
      const existing = localElements[id]
      if (!existing) return
      const box = clampBox(
        { grid_x: cell.x, grid_y: cell.y, width: existing.width, height: existing.height },
        cols,
        rows
      )
      setLocalElements((prev) => ({ ...prev, [id]: { ...existing, ...box } }))
    }
    setDraggedItem(null)
    setDragPreview(null)
  }

  const handleResizeStart = (ref: ItemRef, e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    let startW = 0,
      startH = 0,
      startGX = 0,
      startGY = 0
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
      const scaled = cellSize * zoom
      const dx = Math.round((ev.clientX - startX) / scaled)
      const dy = Math.round((ev.clientY - startY) / scaled)
      const box = clampBox(
        { grid_x: startGX, grid_y: startGY, width: startW + dx, height: startH + dy },
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

  // ------------------------------------------------------------------

  if (mode === 'view') {
    return (
      <ViewMode
        containerRef={containerRef}
        gridRef={gridRef}
        cols={cols}
        rows={rows}
        cellSize={cellSize}
        gridPxWidth={gridPxWidth}
        gridPxHeight={gridPxHeight}
        usable={usable}
        availableFloors={availableFloors}
        currentFloor={currentFloor}
        onSelectFloor={setCurrentFloor}
        positions={currentPositions}
        zones={currentZones}
        elements={currentElements}
        tableById={tableById}
        bookingByTableId={bookingByTableId}
        viewDetailId={viewDetailId}
        onSelectDetail={setViewDetailId}
        onOpenWizard={openWizard}
        zoom={zoom}
        setZoom={setZoom}
      />
    )
  }

  // Wizard mode
  return (
    <div className="flex flex-col">
      {error && (
        <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
          {error}
        </div>
      )}

      <WizardShell
        step={step}
        canCancel={hasLayout}
        onCancel={cancelWizard}
      >
        {step === 1 && (
          <Step1Shape
            shapeMode={shapeMode}
            setShapeMode={(m) => {
              setShapeMode(m)
              persistShape({ shapeMode: m })
            }}
            lengthM={lengthM}
            setLengthM={(v) => {
              setLengthM(v)
              persistShape({ lengthM: v })
            }}
            widthM={widthM}
            setWidthM={(v) => {
              setWidthM(v)
              persistShape({ widthM: v })
            }}
            resolution={resolution}
            setResolution={(v) => {
              setResolution(v)
              persistShape({ resolution: v })
            }}
            activeCells={activeCells}
            setActiveCells={(next) => {
              setActiveCells(next)
              persistShape({ activeCells: Array.from(next) })
            }}
          />
        )}

        {step === 2 && (
          <Step2Elements
            containerRef={containerRef}
            gridRef={gridRef}
            cols={cols}
            rows={rows}
            cellSize={cellSize}
            gridPxWidth={gridPxWidth}
            gridPxHeight={gridPxHeight}
            usable={usable}
            shapeMode={shapeMode}
            zones={currentZones}
            elements={currentElements}
            selectedItem={selectedItem}
            setSelectedItem={setSelectedItem}
            draggedItem={draggedItem}
            dragPreview={dragPreview}
            setDragPreview={setDragPreview}
            placementType={placementType}
            setPlacementType={setPlacementType}
            zoneFormOpen={zoneFormOpen}
            setZoneFormOpen={setZoneFormOpen}
            pendingZone={pendingZone}
            zoneDrawing={zoneDrawing}
            setZoneDrawing={setZoneDrawing}
            onSubmitZoneForm={beginZoneSubmit}
            onCancelZoneForm={() => {
              setPendingZone(null)
              setZoneFormOpen(false)
            }}
            onPlaceElementAtCell={placeElementAtCell}
            onFinalizeZone={finalizeZone}
            onItemDragStart={handleItemDragStart}
            onItemDragEnd={handleItemDragEnd}
            onGridDragOver={handleGridDragOver}
            onGridDrop={handleGridDrop}
            onResizeStart={handleResizeStart}
            onDeleteSelected={handleDeleteSelected}
            onRotateSelected={handleRotateSelected}
            zoom={zoom}
            setZoom={setZoom}
          />
        )}

        {step === 3 && (
          <Step3Tables
            containerRef={containerRef}
            gridRef={gridRef}
            cols={cols}
            rows={rows}
            cellSize={cellSize}
            gridPxWidth={gridPxWidth}
            gridPxHeight={gridPxHeight}
            usable={usable}
            shapeMode={shapeMode}
            zones={currentZones}
            elements={currentElements}
            positions={currentPositions}
            unplacedTables={unplaced}
            tableById={tableById}
            availableFloors={availableFloors}
            currentFloor={currentFloor}
            onSelectFloor={setCurrentFloor}
            onAddFloor={handleAddFloor}
            onDeleteFloor={handleDeleteFloor}
            selectedItem={selectedItem}
            setSelectedItem={setSelectedItem}
            draggedItem={draggedItem}
            dragPreview={dragPreview}
            onItemDragStart={handleItemDragStart}
            onItemDragEnd={handleItemDragEnd}
            onGridDragOver={handleGridDragOver}
            onGridDrop={handleGridDrop}
            onResizeStart={handleResizeStart}
            onDeleteSelected={handleDeleteSelected}
            zoom={zoom}
            setZoom={setZoom}
          />
        )}

        <WizardFooter
          step={step}
          canNext={step !== 1 || step1Valid}
          saving={saving}
          onBack={goBack}
          onNext={goNext}
          onSave={handleSave}
        />
      </WizardShell>
    </div>
  )
}

// ------------ Wizard shell & footer -----------------------------------

function WizardShell({
  step,
  canCancel,
  onCancel,
  children,
}: {
  step: WizardStep
  canCancel: boolean
  onCancel: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <Progress step={step} />
        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-xs font-medium text-[#6b7280] hover:border-[#111827] hover:text-[#111827] transition"
          >
            Annuller
          </button>
        )}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  )
}

function Progress({ step }: { step: WizardStep }) {
  const steps: { n: WizardStep; label: string }[] = [
    { n: 1, label: 'Lokalets form' },
    { n: 2, label: 'Elementer & zoner' },
    { n: 3, label: 'Borde' },
  ]
  return (
    <ol className="flex flex-wrap items-center gap-3">
      {steps.map((s, i) => {
        const completed = step > s.n
        const active = step === s.n
        return (
          <li key={s.n} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                completed
                  ? 'bg-[#10b981] text-white'
                  : active
                    ? 'bg-[#f59e0b] text-white'
                    : 'bg-[#f3f4f6] text-[#6b7280]'
              }`}
            >
              {completed ? <CheckCircle2 size={14} /> : s.n}
            </div>
            <span
              className={`text-xs font-medium ${
                active ? 'text-[#111827]' : completed ? 'text-[#065f46]' : 'text-[#6b7280]'
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="text-[#d1d5db]">›</span>}
          </li>
        )
      })}
    </ol>
  )
}

function WizardFooter({
  step,
  canNext,
  saving,
  onBack,
  onNext,
  onSave,
}: {
  step: WizardStep
  canNext: boolean
  saving: boolean
  onBack: () => void
  onNext: () => void
  onSave: () => void
}) {
  return (
    <div className="mt-6 flex items-center justify-end gap-2 border-t border-[#e5e7eb] pt-4">
      {step > 1 && (
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#111827] hover:border-[#111827] transition disabled:opacity-50"
        >
          Tilbage
        </button>
      )}
      {step < 3 ? (
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="rounded-lg bg-[#f59e0b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d97706] transition disabled:opacity-50"
        >
          Næste
        </button>
      ) : (
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#f59e0b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d97706] transition disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Gemmer…' : 'Gem layout'}
        </button>
      )}
    </div>
  )
}

// ------------ Step 1 --------------------------------------------------

function Step1Shape({
  shapeMode,
  setShapeMode,
  lengthM,
  setLengthM,
  widthM,
  setWidthM,
  resolution,
  setResolution,
  activeCells,
  setActiveCells,
}: {
  shapeMode: ShapeMode
  setShapeMode: (m: ShapeMode) => void
  lengthM: number
  setLengthM: (v: number) => void
  widthM: number
  setWidthM: (v: number) => void
  resolution: Resolution
  setResolution: (v: Resolution) => void
  activeCells: Set<string>
  setActiveCells: (s: Set<string>) => void
}) {
  return (
    <div>
      <h2 className="text-base font-semibold text-[#111827]">
        Hvordan ser dit lokale ud?
      </h2>
      <p className="mt-1 text-xs text-[#6b7280]">
        Vælg rektangel hvis lokalet er firkantet, eller tegn det selv for
        uregelmæssige rum.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ShapeCard
          title="Rektangulært lokale"
          description="Indtast længde og bredde i meter."
          active={shapeMode === 'rect'}
          onSelect={() => setShapeMode('rect')}
        >
          <RectForm
            lengthM={lengthM}
            setLengthM={setLengthM}
            widthM={widthM}
            setWidthM={setWidthM}
            resolution={resolution}
            setResolution={setResolution}
            disabled={shapeMode !== 'rect'}
          />
        </ShapeCard>

        <ShapeCard
          title="Tegn selv"
          description="Klik og træk for at markere lokalets gulv."
          active={shapeMode === 'draw'}
          onSelect={() => setShapeMode('draw')}
        >
          <DrawCanvas
            activeCells={activeCells}
            setActiveCells={setActiveCells}
            disabled={shapeMode !== 'draw'}
          />
        </ShapeCard>
      </div>
    </div>
  )
}

function ShapeCard({
  title,
  description,
  active,
  onSelect,
  children,
}: {
  title: string
  description: string
  active: boolean
  onSelect: () => void
  children: React.ReactNode
}) {
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-xl border-2 p-4 transition ${
        active ? 'border-[#f59e0b] bg-[#fffbeb]/50' : 'border-[#e5e7eb] bg-white opacity-70 hover:opacity-100'
      }`}
    >
      <div className="flex items-start gap-2">
        <div
          className={`mt-0.5 h-4 w-4 rounded-full border-2 ${
            active ? 'border-[#f59e0b] bg-[#f59e0b]' : 'border-[#d1d5db] bg-white'
          }`}
        />
        <div>
          <h3 className="text-sm font-semibold text-[#111827]">{title}</h3>
          <p className="mt-0.5 text-xs text-[#6b7280]">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function RectForm({
  lengthM,
  setLengthM,
  widthM,
  setWidthM,
  resolution,
  setResolution,
  disabled,
}: {
  lengthM: number
  setLengthM: (v: number) => void
  widthM: number
  setWidthM: (v: number) => void
  resolution: Resolution
  setResolution: (v: Resolution) => void
  disabled: boolean
}) {
  const cols = Math.max(1, Math.round(lengthM / resolution))
  const rows = Math.max(1, Math.round(widthM / resolution))
  const inputClass =
    'w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[#f59e0b] focus:outline-none focus:ring-1 focus:ring-[#f59e0b] disabled:bg-[#f9fafb] disabled:opacity-60'
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-[#6b7280]">Længde (m)</span>
          <input
            type="number"
            min={MIN_METERS}
            max={MAX_METERS}
            step="0.5"
            value={lengthM}
            onChange={(e) => setLengthM(Number(e.target.value))}
            disabled={disabled}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-[#6b7280]">Bredde (m)</span>
          <input
            type="number"
            min={MIN_METERS}
            max={MAX_METERS}
            step="0.5"
            value={widthM}
            onChange={(e) => setWidthM(Number(e.target.value))}
            disabled={disabled}
            className={inputClass}
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-[#6b7280]">Opløsning</span>
        <select
          value={resolution}
          onChange={(e) => setResolution(Number(e.target.value) as Resolution)}
          disabled={disabled}
          className={inputClass}
        >
          <option value={1}>Lav (1 m/celle)</option>
          <option value={0.5}>Høj (0,5 m/celle)</option>
        </select>
      </label>
      <div className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-xs text-[#6b7280]">
        Dit grid bliver <strong className="text-[#111827]">{cols} × {rows}</strong> celler
      </div>
    </div>
  )
}

function DrawCanvas({
  activeCells,
  setActiveCells,
  disabled,
}: {
  activeCells: Set<string>
  setActiveCells: (s: Set<string>) => void
  disabled: boolean
}) {
  const [brushSize, setBrushSize] = useState<1 | 2>(1)
  const paintingRef = useRef<'add' | 'remove' | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  const applyBrush = (cx: number, cy: number, mode: 'add' | 'remove') => {
    const next = new Set(activeCells)
    const size = brushSize
    for (let dx = 0; dx < size; dx++) {
      for (let dy = 0; dy < size; dy++) {
        const x = cx + dx
        const y = cy + dy
        if (x < 0 || y < 0 || x >= DRAW_COLS || y >= DRAW_ROWS) continue
        const k = cellKey(x, y)
        if (mode === 'add') next.add(k)
        else next.delete(k)
      }
    }
    setActiveCells(next)
  }

  const cellFromClient = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const el = canvasRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const x = Math.floor((clientX - rect.left) / DRAW_CELL)
    const y = Math.floor((clientY - rect.top) / DRAW_CELL)
    if (x < 0 || y < 0 || x >= DRAW_COLS || y >= DRAW_ROWS) return null
    return { x, y }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return
    const cell = cellFromClient(e.clientX, e.clientY)
    if (!cell) return
    e.preventDefault()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const isActive = activeCells.has(cellKey(cell.x, cell.y))
    const mode: 'add' | 'remove' = isActive ? 'remove' : 'add'
    paintingRef.current = mode
    applyBrush(cell.x, cell.y, mode)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!paintingRef.current || disabled) return
    const cell = cellFromClient(e.clientX, e.clientY)
    if (!cell) return
    applyBrush(cell.x, cell.y, paintingRef.current)
  }

  const onPointerUp = () => {
    paintingRef.current = null
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-[#e5e7eb] bg-white p-0.5">
          {([1, 2] as const).map((s) => {
            const active = s === brushSize
            return (
              <button
                key={s}
                type="button"
                onClick={() => setBrushSize(s)}
                disabled={disabled}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                  active ? 'bg-[#f59e0b] text-white' : 'text-[#6b7280] hover:text-[#111827]'
                } disabled:opacity-50`}
              >
                Pensel {s}×{s}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => setActiveCells(new Set())}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white px-2 py-1 text-[11px] font-medium text-[#6b7280] hover:border-[#b91c1c] hover:text-[#b91c1c] transition disabled:opacity-50"
        >
          <Eraser size={12} />
          Ryd alt
        </button>
      </div>

      <div className="mt-3 overflow-auto rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-2" style={{ maxHeight: 420 }}>
        <div
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative touch-none"
          style={{
            width: DRAW_COLS * DRAW_CELL,
            height: DRAW_ROWS * DRAW_CELL,
            backgroundImage:
              'linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)',
            backgroundSize: `${DRAW_CELL}px ${DRAW_CELL}px`,
            backgroundColor: '#f9fafb',
            userSelect: 'none',
          }}
        >
          {Array.from(activeCells).map((k) => {
            const { x, y } = parseCellKey(k)
            return (
              <div
                key={k}
                className="absolute border border-[#111827] bg-white"
                style={{
                  left: x * DRAW_CELL,
                  top: y * DRAW_CELL,
                  width: DRAW_CELL,
                  height: DRAW_CELL,
                }}
              />
            )
          })}
        </div>
      </div>

      <div className="mt-2 text-[11px] text-[#6b7280]">
        {activeCells.size} celler markeret
        {activeCells.size > 0 && activeCells.size < DRAW_MIN_CELLS && (
          <span className="ml-1 text-[#b91c1c]">
            — mindst {DRAW_MIN_CELLS} celler krævet
          </span>
        )}
      </div>
    </div>
  )
}

// ------------ Step 2 --------------------------------------------------

type Step2Props = {
  containerRef: React.RefObject<HTMLDivElement | null>
  gridRef: React.RefObject<HTMLDivElement | null>
  cols: number
  rows: number
  cellSize: number
  gridPxWidth: number
  gridPxHeight: number
  usable: (x: number, y: number) => boolean
  shapeMode: ShapeMode
  zones: Zone[]
  elements: FloorElement[]
  selectedItem: ItemRef | null
  setSelectedItem: (r: ItemRef | null) => void
  draggedItem: ItemRef | null
  dragPreview: { x: number; y: number; w: number; h: number } | null
  setDragPreview: (p: { x: number; y: number; w: number; h: number } | null) => void
  placementType: FloorElementType | null
  setPlacementType: (t: FloorElementType | null) => void
  zoneFormOpen: boolean
  setZoneFormOpen: (v: boolean) => void
  pendingZone: { name: string; priority: number; color: ZoneColor } | null
  zoneDrawing: { startX: number; startY: number; endX: number; endY: number } | null
  setZoneDrawing: (d: { startX: number; startY: number; endX: number; endY: number } | null) => void
  onSubmitZoneForm: (input: { name: string; priority: number; color: ZoneColor }) => void
  onCancelZoneForm: () => void
  onPlaceElementAtCell: (cx: number, cy: number) => void
  onFinalizeZone: (a: { x: number; y: number }, b: { x: number; y: number }) => void
  onItemDragStart: (ref: ItemRef, e: ReactDragEvent<HTMLDivElement>) => void
  onItemDragEnd: () => void
  onGridDragOver: (e: ReactDragEvent<HTMLDivElement>) => void
  onGridDrop: (e: ReactDragEvent<HTMLDivElement>) => void
  onResizeStart: (ref: ItemRef, e: ReactPointerEvent<HTMLDivElement>) => void
  onDeleteSelected: () => void
  onRotateSelected: () => void
  zoom: number
  setZoom: (z: number) => void
}

function Step2Elements(props: Step2Props) {
  const {
    containerRef,
    gridRef,
    cols,
    rows,
    cellSize,
    gridPxWidth,
    gridPxHeight,
    usable,
    shapeMode,
    zones,
    elements,
    selectedItem,
    setSelectedItem,
    draggedItem,
    dragPreview,
    placementType,
    setPlacementType,
    zoneFormOpen,
    setZoneFormOpen,
    pendingZone,
    zoneDrawing,
    setZoneDrawing,
    onSubmitZoneForm,
    onCancelZoneForm,
    onPlaceElementAtCell,
    onFinalizeZone,
    onItemDragStart,
    onItemDragEnd,
    onGridDragOver,
    onGridDrop,
    onResizeStart,
    onDeleteSelected,
    onRotateSelected,
    zoom,
    setZoom,
  } = props

  const cursorMode = placementType ? 'place-element' : pendingZone ? 'draw-zone' : 'idle'

  const gridCellFromClient = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    const scaled = cellSize * zoom
    const x = Math.floor((clientX - rect.left) / scaled)
    const y = Math.floor((clientY - rect.top) / scaled)
    if (x < 0 || y < 0 || x >= cols || y >= rows) return null
    return { x, y }
  }

  const onGridPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (cursorMode === 'idle') return
    const cell = gridCellFromClient(e.clientX, e.clientY)
    if (!cell) return
    if (cursorMode === 'place-element') {
      onPlaceElementAtCell(cell.x, cell.y)
    } else if (cursorMode === 'draw-zone') {
      e.preventDefault()
      ;(e.target as Element).setPointerCapture(e.pointerId)
      setZoneDrawing({ startX: cell.x, startY: cell.y, endX: cell.x, endY: cell.y })
    }
  }

  const onGridPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!zoneDrawing) return
    const cell = gridCellFromClient(e.clientX, e.clientY)
    if (!cell) return
    setZoneDrawing({ ...zoneDrawing, endX: cell.x, endY: cell.y })
  }

  const onGridPointerUp = () => {
    if (!zoneDrawing || !pendingZone) {
      setZoneDrawing(null)
      return
    }
    onFinalizeZone(
      { x: zoneDrawing.startX, y: zoneDrawing.startY },
      { x: zoneDrawing.endX, y: zoneDrawing.endY }
    )
  }

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="w-full shrink-0 space-y-5 lg:w-56">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
              Elementer
            </h3>
            <p className="mt-1 text-[11px] text-[#9ca3af]">
              Klik et element, og klik derefter en celle for at placere det.
            </p>
            <ul className="mt-2 space-y-1">
              {ELEMENT_ORDER.map((t) => {
                const active = placementType === t
                return (
                  <li key={t}>
                    <button
                      type="button"
                      onClick={() =>
                        setPlacementType(active ? null : t)
                      }
                      className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition ${
                        active
                          ? 'border-[#f59e0b] bg-[#fef3c7] text-[#92400e]'
                          : 'border-[#e5e7eb] bg-white text-[#111827] hover:border-[#f59e0b]'
                      }`}
                    >
                      {ELEMENT_CONFIGS[t].menuLabel}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
              Zoner
            </h3>
            <p className="mt-1 text-[11px] text-[#9ca3af]">
              Opret en zone, og træk derefter et rektangel på gridet.
            </p>
            {pendingZone ? (
              <div className="mt-2 rounded-lg border border-[#f59e0b] bg-[#fffbeb] px-2.5 py-2 text-[11px]">
                <div className="font-semibold text-[#92400e]">
                  Træk rektangel for &ldquo;{pendingZone.name}&rdquo;
                </div>
                <button
                  type="button"
                  onClick={onCancelZoneForm}
                  className="mt-1 text-[10px] font-medium text-[#b45309] hover:underline"
                >
                  Annuller
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setZoneFormOpen(true)}
                className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[#e5e7eb] bg-white px-2.5 py-2 text-xs font-medium text-[#6b7280] hover:border-[#f59e0b] hover:text-[#f59e0b] transition"
              >
                <Plus size={12} />
                Tilføj zone
              </button>
            )}

            {selectedItem && (
              <div className="mt-3 space-y-2">
                {selectedItem.kind === 'element' && (
                  <button
                    type="button"
                    onClick={onRotateSelected}
                    className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#111827] hover:border-[#f59e0b] hover:text-[#f59e0b] transition"
                  >
                    <RotateCw size={12} />
                    Roter
                  </button>
                )}
                <button
                  type="button"
                  onClick={onDeleteSelected}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-[#fecaca] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#b91c1c] hover:bg-[#fef2f2] transition"
                >
                  <Trash2 size={12} />
                  Slet valgte ({selectedItem.kind === 'zone' ? 'zone' : 'element'})
                </button>
                <p className="text-[10px] text-[#9ca3af]">
                  (eller tryk Backspace for at slette)
                </p>
              </div>
            )}
          </div>
        </aside>

        <ZoomedScrollGrid
          containerRef={containerRef}
          gridRef={gridRef}
          cols={cols}
          rows={rows}
          cellSize={cellSize}
          gridPxWidth={gridPxWidth}
          gridPxHeight={gridPxHeight}
          usable={usable}
          shapeMode={shapeMode}
          zoom={zoom}
          setZoom={setZoom}
          cursor={cursorMode === 'idle' ? 'default' : 'crosshair'}
          onPointerDown={onGridPointerDown}
          onPointerMove={onGridPointerMove}
          onPointerUp={onGridPointerUp}
          onDragOver={onGridDragOver}
          onDrop={onGridDrop}
          onClick={(e) => {
            if (cursorMode !== 'idle') return
            e.stopPropagation()
            setSelectedItem(null)
          }}
        >
            {zones.map((z) => (
              <ZoneShape
                key={z.id}
                zone={z}
                cellSize={cellSize}
                selected={selectedItem?.kind === 'zone' && selectedItem.id === z.id}
                dragging={draggedItem?.kind === 'zone' && draggedItem.id === z.id}
                editable={cursorMode === 'idle'}
                onClick={(e) => {
                  if (cursorMode !== 'idle') return
                  e.stopPropagation()
                  setSelectedItem({ kind: 'zone', id: z.id })
                }}
                onDragStart={(e) => onItemDragStart({ kind: 'zone', id: z.id }, e)}
                onDragEnd={onItemDragEnd}
                onResizeStart={(e) => onResizeStart({ kind: 'zone', id: z.id }, e)}
              />
            ))}
            {elements.map((el) => (
              <ElementShape
                key={el.id}
                element={el}
                cellSize={cellSize}
                selected={selectedItem?.kind === 'element' && selectedItem.id === el.id}
                dragging={draggedItem?.kind === 'element' && draggedItem.id === el.id}
                editable={cursorMode === 'idle'}
                onClick={(e) => {
                  if (cursorMode !== 'idle') return
                  e.stopPropagation()
                  setSelectedItem({ kind: 'element', id: el.id })
                }}
                onDragStart={(e) => onItemDragStart({ kind: 'element', id: el.id }, e)}
                onDragEnd={onItemDragEnd}
                onResizeStart={(e) => onResizeStart({ kind: 'element', id: el.id }, e)}
              />
            ))}

            {zoneDrawing && pendingZone && (
              <div
                className="pointer-events-none absolute rounded-md border-2 border-dashed"
                style={{
                  left: Math.min(zoneDrawing.startX, zoneDrawing.endX) * cellSize,
                  top: Math.min(zoneDrawing.startY, zoneDrawing.endY) * cellSize,
                  width:
                    (Math.abs(zoneDrawing.endX - zoneDrawing.startX) + 1) * cellSize,
                  height:
                    (Math.abs(zoneDrawing.endY - zoneDrawing.startY) + 1) * cellSize,
                  borderColor: ZONE_COLORS[pendingZone.color].border,
                  backgroundColor: ZONE_COLORS[pendingZone.color].bg,
                }}
              />
            )}

            {dragPreview && (
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
        </ZoomedScrollGrid>
      </div>

      {zoneFormOpen && (
        <ZoneFormModal
          onClose={onCancelZoneForm}
          onSubmit={onSubmitZoneForm}
        />
      )}
    </div>
  )
}

// ------------ Step 3 --------------------------------------------------

type Step3Props = {
  containerRef: React.RefObject<HTMLDivElement | null>
  gridRef: React.RefObject<HTMLDivElement | null>
  cols: number
  rows: number
  cellSize: number
  gridPxWidth: number
  gridPxHeight: number
  usable: (x: number, y: number) => boolean
  shapeMode: ShapeMode
  zones: Zone[]
  elements: FloorElement[]
  positions: TablePosition[]
  unplacedTables: RestaurantTable[]
  tableById: Map<string, RestaurantTable>
  availableFloors: number[]
  currentFloor: number
  onSelectFloor: (n: number) => void
  onAddFloor: () => void
  onDeleteFloor: (n: number) => void
  selectedItem: ItemRef | null
  setSelectedItem: (r: ItemRef | null) => void
  draggedItem: ItemRef | null
  dragPreview: { x: number; y: number; w: number; h: number } | null
  onItemDragStart: (ref: ItemRef, e: ReactDragEvent<HTMLDivElement>) => void
  onItemDragEnd: () => void
  onGridDragOver: (e: ReactDragEvent<HTMLDivElement>) => void
  onGridDrop: (e: ReactDragEvent<HTMLDivElement>) => void
  onResizeStart: (ref: ItemRef, e: ReactPointerEvent<HTMLDivElement>) => void
  onDeleteSelected: () => void
  zoom: number
  setZoom: (z: number) => void
}

function Step3Tables(props: Step3Props) {
  const {
    containerRef,
    gridRef,
    cols,
    rows,
    cellSize,
    gridPxWidth,
    gridPxHeight,
    usable,
    shapeMode,
    zones,
    elements,
    positions,
    unplacedTables,
    tableById,
    availableFloors,
    currentFloor,
    onSelectFloor,
    onAddFloor,
    onDeleteFloor,
    selectedItem,
    setSelectedItem,
    draggedItem,
    dragPreview,
    onItemDragStart,
    onItemDragEnd,
    onGridDragOver,
    onGridDrop,
    onResizeStart,
    onDeleteSelected,
    zoom,
    setZoom,
  } = props

  return (
    <div>
      <FloorTabs
        floors={availableFloors}
        currentFloor={currentFloor}
        onSelect={onSelectFloor}
        onAdd={onAddFloor}
        onDelete={onDeleteFloor}
      />

      <div className="mt-4 flex flex-col gap-4 lg:flex-row">
        <aside className="w-full shrink-0 space-y-3 lg:w-56">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
              Ikke placeret
            </h3>
            <p className="mt-1 text-[11px] text-[#9ca3af]">
              Træk et bord ind på gridet for at placere det på etage {currentFloor}.
            </p>
            {unplacedTables.length === 0 ? (
              <p className="mt-2 text-xs text-[#6b7280]">Alle borde er placeret.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {unplacedTables.map((t) => (
                  <li key={t.id}>
                    <div
                      draggable
                      onDragStart={(e) => onItemDragStart({ kind: 'table', id: t.id }, e)}
                      onDragEnd={onItemDragEnd}
                      className="cursor-grab rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-2.5 py-2 text-xs text-[#111827] hover:border-[#f59e0b] active:cursor-grabbing"
                    >
                      <div className="font-semibold">Bord {t.table_number}</div>
                      <div className="text-[10px] text-[#6b7280]">
                        {t.capacity} pladser
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedItem && selectedItem.kind === 'table' && (
            <button
              type="button"
              onClick={onDeleteSelected}
              className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-[#fecaca] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#b91c1c] hover:bg-[#fef2f2] transition"
            >
              <Trash2 size={12} />
              Fjern bord fra grid
            </button>
          )}
        </aside>

        <ZoomedScrollGrid
          containerRef={containerRef}
          gridRef={gridRef}
          cols={cols}
          rows={rows}
          cellSize={cellSize}
          gridPxWidth={gridPxWidth}
          gridPxHeight={gridPxHeight}
          usable={usable}
          shapeMode={shapeMode}
          zoom={zoom}
          setZoom={setZoom}
          onDragOver={onGridDragOver}
          onDrop={onGridDrop}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedItem(null)
          }}
        >
            {zones.map((z) => (
              <ZoneShape
                key={z.id}
                zone={z}
                cellSize={cellSize}
                selected={false}
                dragging={false}
                editable={false}
              />
            ))}
            {elements.map((el) => (
              <ElementShape
                key={el.id}
                element={el}
                cellSize={cellSize}
                selected={false}
                dragging={false}
                editable={false}
              />
            ))}

            {positions.map((p) => {
              const t = tableById.get(p.table_id)
              if (!t) return null
              const isSelected = selectedItem?.kind === 'table' && selectedItem.id === p.table_id
              const isDragging = draggedItem?.kind === 'table' && draggedItem.id === p.table_id
              return (
                <SetupTableCard
                  key={p.table_id}
                  position={p}
                  table={t}
                  cellSize={cellSize}
                  selected={isSelected}
                  dragging={isDragging}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedItem(
                      selectedItem?.kind === 'table' && selectedItem.id === p.table_id
                        ? null
                        : { kind: 'table', id: p.table_id }
                    )
                  }}
                  onDragStart={(e) => onItemDragStart({ kind: 'table', id: p.table_id }, e)}
                  onDragEnd={onItemDragEnd}
                  onResizeStart={(e) => onResizeStart({ kind: 'table', id: p.table_id }, e)}
                />
              )
            })}

            {dragPreview && (
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
        </ZoomedScrollGrid>
      </div>
    </div>
  )
}

// ------------ View mode -----------------------------------------------

type ViewModeProps = {
  containerRef: React.RefObject<HTMLDivElement | null>
  gridRef: React.RefObject<HTMLDivElement | null>
  cols: number
  rows: number
  cellSize: number
  gridPxWidth: number
  gridPxHeight: number
  usable: (x: number, y: number) => boolean
  availableFloors: number[]
  currentFloor: number
  onSelectFloor: (n: number) => void
  positions: TablePosition[]
  zones: Zone[]
  elements: FloorElement[]
  tableById: Map<string, RestaurantTable>
  bookingByTableId: Map<string, TodayBooking>
  viewDetailId: string | null
  onSelectDetail: (id: string | null) => void
  onOpenWizard: () => void
  zoom: number
  setZoom: (z: number) => void
}

function ViewMode(props: ViewModeProps) {
  const {
    containerRef,
    gridRef,
    cols,
    rows,
    cellSize,
    gridPxWidth,
    gridPxHeight,
    usable,
    availableFloors,
    currentFloor,
    onSelectFloor,
    positions,
    zones,
    elements,
    tableById,
    bookingByTableId,
    viewDetailId,
    onSelectDetail,
    onOpenWizard,
    zoom,
    setZoom,
  } = props

  const detailTable = viewDetailId ? tableById.get(viewDetailId) ?? null : null
  const detailBooking = viewDetailId ? bookingByTableId.get(viewDetailId) ?? null : null
  const detailStatus = statusFromBooking(detailBooking)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FloorTabs
          floors={availableFloors}
          currentFloor={currentFloor}
          onSelect={onSelectFloor}
          onAdd={null}
          onDelete={null}
        />
        <button
          type="button"
          onClick={onOpenWizard}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-sm font-medium text-[#111827] hover:border-[#f59e0b] hover:text-[#f59e0b] transition"
        >
          <Pencil size={14} />
          Rediger layout
        </button>
      </div>

      <div className="mt-4">
        <ZoomedScrollGrid
          containerRef={containerRef}
          gridRef={gridRef}
          cols={cols}
          rows={rows}
          cellSize={cellSize}
          gridPxWidth={gridPxWidth}
          gridPxHeight={gridPxHeight}
          usable={usable}
          shapeMode="rect"
          zoom={zoom}
          setZoom={setZoom}
        >
          {zones.map((z) => (
            <ZoneShape
              key={z.id}
              zone={z}
              cellSize={cellSize}
              selected={false}
              dragging={false}
              editable={false}
            />
          ))}
          {elements.map((el) => (
            <ElementShape
              key={el.id}
              element={el}
              cellSize={cellSize}
              selected={false}
              dragging={false}
              editable={false}
            />
          ))}
          {positions.map((p) => {
            const t = tableById.get(p.table_id)
            if (!t) return null
            const booking = bookingByTableId.get(p.table_id) ?? null
            return (
              <ViewTableCard
                key={p.table_id}
                position={p}
                table={t}
                status={statusFromBooking(booking)}
                cellSize={cellSize}
                onClick={() => onSelectDetail(p.table_id)}
              />
            )
          })}
        </ZoomedScrollGrid>
      </div>

      {detailTable && viewDetailId && (
        <StatusPopover
          table={detailTable}
          status={detailStatus}
          onClose={() => onSelectDetail(null)}
        />
      )}
    </div>
  )
}

type TableStatus = 'ledig' | 'afventer' | 'optaget'

function statusFromBooking(b: TodayBooking | null): TableStatus {
  if (!b) return 'ledig'
  return b.status === 'pending' ? 'afventer' : 'optaget'
}

const STATUS_META: Record<
  TableStatus,
  { label: string; card: string; badge: string; dot: string }
> = {
  ledig: {
    label: 'Ledig',
    card: 'border-[#e5e7eb] bg-white text-[#111827]',
    badge: 'bg-[#f3f4f6] text-[#6b7280]',
    dot: 'bg-[#9ca3af]',
  },
  afventer: {
    label: 'Afventer',
    card: 'border-[#f59e0b] bg-[#fef3c7] text-[#92400e]',
    badge: 'bg-[#fffbeb] text-[#b45309]',
    dot: 'bg-[#f59e0b]',
  },
  optaget: {
    label: 'Optaget',
    card: 'border-[#10b981] bg-[#d1fae5] text-[#065f46]',
    badge: 'bg-[#ecfdf5] text-[#047857]',
    dot: 'bg-[#10b981]',
  },
}

// ------------ Grid surface --------------------------------------------

function GridSurface({
  gridRef,
  cols,
  rows,
  cellSize,
  gridPxWidth,
  gridPxHeight,
  usable,
  shapeMode,
  cursor,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDragOver,
  onDrop,
  children,
}: {
  gridRef: React.RefObject<HTMLDivElement | null>
  cols: number
  rows: number
  cellSize: number
  gridPxWidth: number
  gridPxHeight: number
  usable: (x: number, y: number) => boolean
  shapeMode: ShapeMode
  cursor?: 'default' | 'crosshair'
  onClick?: (e: ReactMouseEvent<HTMLDivElement>) => void
  onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove?: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp?: (e: ReactPointerEvent<HTMLDivElement>) => void
  onDragOver?: (e: ReactDragEvent<HTMLDivElement>) => void
  onDrop?: (e: ReactDragEvent<HTMLDivElement>) => void
  children: React.ReactNode
}) {
  const unusableCells: React.ReactNode[] = []
  if (shapeMode === 'draw') {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!usable(x, y)) {
          unusableCells.push(
            <div
              key={`u-${x}-${y}`}
              className="pointer-events-none absolute"
              style={{
                left: x * cellSize,
                top: y * cellSize,
                width: cellSize,
                height: cellSize,
                backgroundColor: '#f3f4f6',
                border: '1px dashed #e5e7eb',
              }}
            />
          )
        }
      }
    }
  }

  return (
    <div
      ref={gridRef}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="relative"
      style={{
        width: gridPxWidth,
        height: gridPxHeight,
        overflow: 'hidden',
        backgroundColor: '#fafafa',
        backgroundImage:
          'linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)',
        backgroundSize: `${cellSize}px ${cellSize}px`,
        cursor: cursor ?? 'default',
        touchAction: 'none',
      }}
    >
      {unusableCells}
      {children}
    </div>
  )
}

// ------------ Floor tabs ----------------------------------------------

function ZoomControls({
  zoom,
  setZoom,
}: {
  zoom: number
  setZoom: (z: number) => void
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white p-0.5 shadow-sm">
      <button
        type="button"
        onClick={() => setZoom(zoom - 0.1)}
        disabled={zoom <= 0.5}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827] disabled:opacity-40"
        aria-label="Zoom ud"
        title="Zoom ud"
      >
        <Minus size={14} />
      </button>
      <span className="min-w-10 text-center text-[11px] font-medium text-[#111827]">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        onClick={() => setZoom(zoom + 0.1)}
        disabled={zoom >= 2}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827] disabled:opacity-40"
        aria-label="Zoom ind"
        title="Zoom ind"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}

function ZoomedScrollGrid({
  containerRef,
  gridRef,
  cols,
  rows,
  cellSize,
  gridPxWidth,
  gridPxHeight,
  usable,
  shapeMode,
  zoom,
  setZoom,
  cursor,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDragOver,
  onDrop,
  children,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  gridRef: React.RefObject<HTMLDivElement | null>
  cols: number
  rows: number
  cellSize: number
  gridPxWidth: number
  gridPxHeight: number
  usable: (x: number, y: number) => boolean
  shapeMode: ShapeMode
  zoom: number
  setZoom: (z: number) => void
  cursor?: 'default' | 'crosshair'
  onClick?: (e: ReactMouseEvent<HTMLDivElement>) => void
  onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove?: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp?: (e: ReactPointerEvent<HTMLDivElement>) => void
  onDragOver?: (e: ReactDragEvent<HTMLDivElement>) => void
  onDrop?: (e: ReactDragEvent<HTMLDivElement>) => void
  children: React.ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const step = e.deltaY > 0 ? -0.1 : 0.1
      setZoom(zoom + step)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, setZoom])

  return (
    <div
      ref={containerRef}
      className="relative flex-1 rounded-xl border border-[#e5e7eb] bg-white p-3"
      style={{ width: '100%', minWidth: 0 }}
    >
      <div className="absolute right-4 top-4 z-50">
        <ZoomControls zoom={zoom} setZoom={setZoom} />
      </div>
      <div
        ref={scrollRef}
        style={{
          overflow: 'auto',
          maxHeight: 'calc(100vh - 380px)',
          width: '100%',
        }}
      >
        <div
          style={{
            width: gridPxWidth * zoom,
            height: gridPxHeight * zoom,
          }}
        >
          <div
            style={{
              width: gridPxWidth,
              height: gridPxHeight,
              transformOrigin: 'top left',
              transform: `scale(${zoom})`,
            }}
          >
            <GridSurface
              gridRef={gridRef}
              cols={cols}
              rows={rows}
              cellSize={cellSize}
              gridPxWidth={gridPxWidth}
              gridPxHeight={gridPxHeight}
              usable={usable}
              shapeMode={shapeMode}
              cursor={cursor}
              onClick={onClick}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              {children}
            </GridSurface>
          </div>
        </div>
      </div>
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
            className={`inline-flex items-center overflow-hidden rounded-lg border transition ${
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

// ------------ Item shapes --------------------------------------------

function ZoneShape({
  zone,
  cellSize,
  selected,
  dragging,
  editable,
  onClick,
  onDragStart,
  onDragEnd,
  onResizeStart,
}: {
  zone: Zone
  cellSize: number
  selected: boolean
  dragging: boolean
  editable: boolean
  onClick?: (e: ReactMouseEvent) => void
  onDragStart?: (e: ReactDragEvent<HTMLDivElement>) => void
  onDragEnd?: () => void
  onResizeStart?: (e: ReactPointerEvent<HTMLDivElement>) => void
}) {
  const cfg = ZONE_COLORS[zone.color]
  const editRing = selected ? 'ring-2 ring-[#f59e0b] ring-offset-1' : ''
  return (
    <div
      draggable={editable}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`absolute z-10 rounded-md border-2 transition ${editRing} ${
        dragging ? 'opacity-50' : ''
      } ${editable ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
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
      {editable && selected && onResizeStart && (
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
  selected,
  dragging,
  editable,
  onClick,
  onDragStart,
  onDragEnd,
  onResizeStart,
}: {
  element: FloorElement
  cellSize: number
  selected: boolean
  dragging: boolean
  editable: boolean
  onClick?: (e: ReactMouseEvent) => void
  onDragStart?: (e: ReactDragEvent<HTMLDivElement>) => void
  onDragEnd?: () => void
  onResizeStart?: (e: ReactPointerEvent<HTMLDivElement>) => void
}) {
  const cfg = ELEMENT_CONFIGS[element.type]
  const Icon = cfg.icon
  const editRing = selected ? 'ring-2 ring-[#f59e0b] ring-offset-1' : ''
  const isWindow = cfg.edgeStripe
  const rotation = ((element.rotation % 360) + 360) % 360
  const stripeVertical = isWindow && (rotation === 90 || rotation === 270)

  return (
    <div
      draggable={editable}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`absolute z-20 rounded-md transition ${editRing} ${
        dragging ? 'opacity-50' : ''
      } ${editable ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
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
            {Icon && <Icon size={Math.min(16, cellSize * 0.35)} />}
            <span
              className="font-semibold"
              style={{ fontSize: Math.max(9, Math.min(12, cellSize * 0.25)) }}
            >
              {element.label ?? cfg.label}
            </span>
          </>
        )}
      </div>
      {editable && selected && onResizeStart && (
        <div
          onPointerDown={onResizeStart}
          className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize border-r-2 border-b-2 border-[#f59e0b] bg-white"
          aria-label="Ændr størrelse"
        />
      )}
    </div>
  )
}

function SetupTableCard({
  position,
  table,
  cellSize,
  selected,
  dragging,
  onClick,
  onDragStart,
  onDragEnd,
  onResizeStart,
}: {
  position: TablePosition
  table: RestaurantTable
  cellSize: number
  selected: boolean
  dragging: boolean
  onClick: (e: ReactMouseEvent) => void
  onDragStart: (e: ReactDragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
  onResizeStart: (e: ReactPointerEvent<HTMLDivElement>) => void
}) {
  const editRing = selected ? 'ring-2 ring-[#f59e0b] ring-offset-1' : ''
  const numberFont = Math.max(9, Math.min(14, cellSize * 0.35))
  const badgeFont = Math.max(7, Math.min(11, cellSize * 0.25))
  const radius = Math.max(4, cellSize * 0.15)
  return (
    <div
      draggable
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`absolute z-30 flex flex-col overflow-hidden border-2 border-[#e5e7eb] bg-white p-1 text-[#111827] transition hover:border-[#f59e0b] ${editRing} ${
        dragging ? 'opacity-50' : ''
      } cursor-grab active:cursor-grabbing`}
      style={{
        left: position.grid_x * cellSize,
        top: position.grid_y * cellSize,
        width: position.width * cellSize,
        height: position.height * cellSize,
        borderRadius: radius,
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <div
          className="font-bold leading-tight"
          style={{ fontSize: numberFont }}
        >
          Bord {table.table_number}
        </div>
        <div
          className="shrink-0 rounded-full bg-[#fef3c7] px-1.5 py-0.5 font-medium text-[#92400e]"
          style={{ fontSize: badgeFont }}
        >
          {table.capacity} pers.
        </div>
      </div>
      {selected && (
        <div
          onPointerDown={onResizeStart}
          className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize border-r-2 border-b-2 border-[#f59e0b] bg-white"
          aria-label="Ændr størrelse"
        />
      )}
    </div>
  )
}

function ViewTableCard({
  position,
  table,
  status,
  cellSize,
  onClick,
}: {
  position: TablePosition
  table: RestaurantTable
  status: TableStatus
  cellSize: number
  onClick: () => void
}) {
  const meta = STATUS_META[status]
  const numberFont = Math.max(9, Math.min(14, cellSize * 0.35))
  const badgeFont = Math.max(7, Math.min(11, cellSize * 0.25))
  const radius = Math.max(4, cellSize * 0.15)
  const dotSize = Math.max(4, cellSize * 0.12)
  const tier: 'tiny' | 'full' = cellSize < 28 ? 'tiny' : 'full'

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`absolute z-30 flex cursor-pointer flex-col overflow-hidden border-2 p-1 transition ${meta.card} ${
        tier === 'tiny' ? 'items-center justify-center' : ''
      }`}
      style={{
        left: position.grid_x * cellSize,
        top: position.grid_y * cellSize,
        width: position.width * cellSize,
        height: position.height * cellSize,
        borderRadius: radius,
      }}
    >
      {tier === 'tiny' ? (
        <div className="flex flex-col items-center gap-0.5">
          <span
            className={`rounded-full ${meta.dot}`}
            style={{ width: dotSize, height: dotSize }}
            aria-hidden
          />
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
          <div className="mt-auto flex items-center gap-1">
            <span
              className={`rounded-full ${meta.dot}`}
              style={{ width: dotSize, height: dotSize }}
              aria-hidden
            />
            <span
              className="font-semibold"
              style={{ fontSize: badgeFont }}
            >
              {meta.label}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// ------------ Popover & zone form -------------------------------------

function StatusPopover({
  table,
  status,
  onClose,
}: {
  table: RestaurantTable
  status: TableStatus
  onClose: () => void
}) {
  const meta = STATUS_META[status]
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-[#111827]">
            Bord {table.table_number}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827] transition"
            aria-label="Luk"
          >
            <X size={14} />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm text-[#6b7280]">
          <span>{table.capacity} pers.</span>
          <span>·</span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}
          >
            {meta.label}
          </span>
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setLocalError('Zonenavn er påkrævet')
      return
    }
    if (priority < 1 || priority > 10) {
      setLocalError('Prioritet skal være mellem 1 og 10')
      return
    }
    onSubmit({ name: name.trim(), priority, color })
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
        <form onSubmit={submit} className="space-y-4 p-5">
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
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#6b7280]">
              Prioritet (1-10, lavere = fyldes først)
            </label>
            <input
              type="number"
              min={1}
              max={10}
              step={1}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className={inputClass}
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
              Fortsæt
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
