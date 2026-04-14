'use client'

import { useState, useTransition } from 'react'
import { LayoutGrid, List, Pencil, Plus, Trash2, X } from 'lucide-react'
import type { RestaurantTable } from '@/app/types/database'
import { createTable, deleteTable, updateTable } from './actions'
import {
  FloorPlan,
  type TablePosition,
  type TodayBooking,
  type Zone,
  type FloorElement,
} from './floor-plan'

type Props = {
  tables: RestaurantTable[]
  positions: TablePosition[]
  zones: Zone[]
  elements: FloorElement[]
  todayBookings: TodayBooking[]
  restaurantId: string
}

type DraftState =
  | { kind: 'closed' }
  | { kind: 'new' }
  | { kind: 'edit'; table: RestaurantTable }

type ViewMode = 'list' | 'plan'

export function TablesClient({
  tables,
  positions,
  zones,
  elements,
  todayBookings,
  restaurantId,
}: Props) {
  const [view, setView] = useState<ViewMode>('list')
  const [draft, setDraft] = useState<DraftState>({ kind: 'closed' })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const nextTableNumber =
    tables.length > 0
      ? Math.max(...tables.map((t) => t.table_number)) + 1
      : 1

  const handleSubmit = (formData: FormData) => {
    setError(null)
    startTransition(async () => {
      try {
        if (draft.kind === 'edit') {
          await updateTable(draft.table.id, formData)
        } else {
          await createTable(formData)
        }
        setDraft({ kind: 'closed' })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Noget gik galt')
      }
    })
  }

  const handleDelete = (id: string, tableNumber: number) => {
    if (!confirm(`Slet bord ${tableNumber}?`)) return
    setError(null)
    setDeletingId(id)
    startTransition(async () => {
      try {
        await deleteTable(id)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Kunne ikke slette bord')
      } finally {
        setDeletingId(null)
      }
    })
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[#e5e7eb] bg-white p-0.5">
          {(
            [
              { v: 'list', l: 'Liste', icon: List },
              { v: 'plan', l: 'Plantegning', icon: LayoutGrid },
            ] as { v: ViewMode; l: string; icon: typeof List }[]
          ).map((o) => {
            const active = o.v === view
            const Icon = o.icon
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => setView(o.v)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'bg-[#f59e0b] text-white'
                    : 'text-[#6b7280] hover:text-[#111827]'
                }`}
              >
                <Icon size={14} />
                {o.l}
              </button>
            )
          })}
        </div>

        {view === 'list' && draft.kind === 'closed' && (
          <button
            type="button"
            onClick={() => setDraft({ kind: 'new' })}
            className="inline-flex items-center gap-2 rounded-lg bg-[#f59e0b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d97706] transition"
          >
            <Plus size={16} />
            Nyt bord
          </button>
        )}
      </div>

      {view === 'plan' ? (
        <FloorPlan
          tables={tables}
          positions={positions}
          zones={zones}
          elements={elements}
          todayBookings={todayBookings}
          restaurantId={restaurantId}
        />
      ) : (
        <ListView
          tables={tables}
          draft={draft}
          setDraft={setDraft}
          error={error}
          setError={setError}
          pending={pending}
          deletingId={deletingId}
          nextTableNumber={nextTableNumber}
          handleSubmit={handleSubmit}
          handleDelete={handleDelete}
        />
      )}
    </div>
  )
}

type ListViewProps = {
  tables: RestaurantTable[]
  draft: DraftState
  setDraft: (d: DraftState) => void
  error: string | null
  setError: (e: string | null) => void
  pending: boolean
  deletingId: string | null
  nextTableNumber: number
  handleSubmit: (formData: FormData) => void
  handleDelete: (id: string, tableNumber: number) => void
}

function ListView({
  tables,
  draft,
  setDraft,
  error,
  setError,
  pending,
  deletingId,
  nextTableNumber,
  handleSubmit,
  handleDelete,
}: ListViewProps) {
  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c]">
          {error}
        </div>
      )}

      {draft.kind !== 'closed' && (
        <TableForm
          key={draft.kind === 'edit' ? draft.table.id : 'new'}
          initial={
            draft.kind === 'edit'
              ? draft.table
              : {
                  table_number: nextTableNumber,
                  capacity: 2,
                  priority: 10,
                  is_active: true,
                }
          }
          isEdit={draft.kind === 'edit'}
          pending={pending}
          onSubmit={handleSubmit}
          onCancel={() => {
            setError(null)
            setDraft({ kind: 'closed' })
          }}
        />
      )}

      {tables.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#e5e7eb] bg-white px-6 py-12 text-center">
          <p className="text-sm text-[#6b7280]">
            Du har ingen borde endnu. Opret dit første bord for at komme i gang.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[#e5e7eb] overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
          {tables.map((t) => {
            const isDeleting = deletingId === t.id && pending
            return (
              <li
                key={t.id}
                className="flex items-center gap-4 px-4 py-3 sm:px-6"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fef3c7] text-sm font-semibold text-[#f59e0b]">
                  {t.table_number}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[#111827]">
                      Bord {t.table_number}
                    </span>
                    {t.is_active ? (
                      <span className="inline-flex items-center rounded-full bg-[#ecfdf5] px-2 py-0.5 text-xs font-medium text-[#047857]">
                        Aktiv
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-[#f3f4f6] px-2 py-0.5 text-xs font-medium text-[#6b7280]">
                        Inaktiv
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-[#6b7280]">
                    {t.capacity} pladser · Prioritet {t.priority}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setDraft({ kind: 'edit', table: t })
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827] transition"
                    aria-label={`Rediger bord ${t.table_number}`}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id, t.table_number)}
                    disabled={isDeleting}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6b7280] hover:bg-[#fef2f2] hover:text-[#b91c1c] transition disabled:opacity-50"
                    aria-label={`Slet bord ${t.table_number}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

type FormInitial = Pick<
  RestaurantTable,
  'table_number' | 'capacity' | 'priority' | 'is_active'
>

function TableForm({
  initial,
  isEdit,
  pending,
  onSubmit,
  onCancel,
}: {
  initial: FormInitial
  isEdit: boolean
  pending: boolean
  onSubmit: (formData: FormData) => void
  onCancel: () => void
}) {
  return (
    <form
      action={onSubmit}
      className="mb-6 rounded-xl border border-[#e5e7eb] bg-white p-5"
    >
      <div className="flex items-start justify-between">
        <h2 className="text-base font-semibold text-[#111827]">
          {isEdit ? 'Rediger bord' : 'Nyt bord'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827] transition"
          aria-label="Luk"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Bordnummer" htmlFor="table_number">
          <input
            id="table_number"
            name="table_number"
            type="number"
            min={1}
            step={1}
            required
            defaultValue={initial.table_number}
            className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[#f59e0b] focus:outline-none focus:ring-1 focus:ring-[#f59e0b]"
          />
        </Field>
        <Field label="Kapacitet" htmlFor="capacity">
          <input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            step={1}
            required
            defaultValue={initial.capacity}
            className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[#f59e0b] focus:outline-none focus:ring-1 focus:ring-[#f59e0b]"
          />
        </Field>
        <Field label="Prioritet" htmlFor="priority">
          <input
            id="priority"
            name="priority"
            type="number"
            step={1}
            required
            defaultValue={initial.priority}
            className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm text-[#111827] focus:border-[#f59e0b] focus:outline-none focus:ring-1 focus:ring-[#f59e0b]"
          />
        </Field>
      </div>

      <label className="mt-4 inline-flex items-center gap-2 text-sm text-[#111827]">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={initial.is_active}
          className="h-4 w-4 rounded border-[#d1d5db] text-[#f59e0b] focus:ring-[#f59e0b]"
        />
        Aktivt bord
      </label>

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
          {pending ? 'Gemmer…' : isEdit ? 'Gem ændringer' : 'Opret bord'}
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
