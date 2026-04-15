'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, CreditCard, Store, User } from 'lucide-react'
import { changePassword, deleteAccount, updateRestaurantInfo } from './actions'

type Restaurant = {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  subscription_status: string | null
  subscription_tier: string | null
  current_period_ends_at: string | null
  stripe_customer_id: string | null
}

type Feedback = { kind: 'ok'; message: string } | { kind: 'err'; message: string } | null

export function SettingsClient({
  userEmail,
  restaurant,
}: {
  userEmail: string
  restaurant: Restaurant
}) {
  return (
    <div className="space-y-8">
      <RestaurantSection restaurant={restaurant} />
      <SubscriptionSection restaurant={restaurant} />
      <AccountSection userEmail={userEmail} />
    </div>
  )
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Store
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-[#e5e7eb] bg-white">
      <header className="flex items-center gap-3 border-b border-[#e5e7eb] px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fef3c7] text-[#f59e0b]">
          <Icon size={18} />
        </div>
        <h2 className="text-base font-semibold text-[#111827]">{title}</h2>
      </header>
      <div className="px-6 py-5">{children}</div>
    </section>
  )
}

function FeedbackBanner({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null
  if (feedback.kind === 'ok') {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#a7f3d0] bg-[#ecfdf5] px-3 py-2 text-sm text-[#047857]">
        <CheckCircle2 size={16} />
        {feedback.message}
      </div>
    )
  }
  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c]">
      <AlertTriangle size={16} />
      {feedback.message}
    </div>
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

function RestaurantSection({ restaurant }: { restaurant: Restaurant }) {
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [pending, startTransition] = useTransition()

  const handleSubmit = (formData: FormData) => {
    setFeedback(null)
    startTransition(async () => {
      const result = await updateRestaurantInfo(formData)
      if (result.ok) {
        setFeedback({ kind: 'ok', message: 'Ændringerne er gemt' })
      } else {
        setFeedback({ kind: 'err', message: result.error })
      }
    })
  }

  return (
    <SectionCard icon={Store} title="Restaurantoplysninger">
      <FeedbackBanner feedback={feedback} />
      <form action={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Navn" htmlFor="name">
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={restaurant.name}
            className={inputClass}
          />
        </Field>
        <Field label="Email" htmlFor="restaurant_email">
          <input
            id="restaurant_email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            defaultValue={restaurant.email ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Adresse" htmlFor="address">
          <input
            id="address"
            name="address"
            type="text"
            defaultValue={restaurant.address ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Telefon" htmlFor="phone">
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={restaurant.phone ?? ''}
            className={inputClass}
          />
        </Field>

        <div className="sm:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-[#f59e0b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d97706] transition disabled:opacity-50"
          >
            {pending ? 'Gemmer…' : 'Gem ændringer'}
          </button>
        </div>
      </form>
    </SectionCard>
  )
}

function formatDanishDate(iso: string): string {
  return new Intl.DateTimeFormat('da-DK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso))
}

function SubscriptionSection({ restaurant }: { restaurant: Restaurant }) {
  const status = restaurant.subscription_status
  const tier = restaurant.subscription_tier
  const isPremium = tier === 'premium'
  const isActive = status === 'active'

  const planLabel = isPremium ? 'Napkind Premium' : 'Gratis'

  const statusMeta: Record<string, { label: string; className: string }> = {
    active: {
      label: 'Aktiv',
      className: 'bg-[#ecfdf5] text-[#047857]',
    },
    trial: {
      label: 'Prøveperiode',
      className: 'bg-[#eff6ff] text-[#1d4ed8]',
    },
    cancelled: {
      label: 'Opsagt',
      className: 'bg-[#fef2f2] text-[#b91c1c]',
    },
    past_due: {
      label: 'Forfalden',
      className: 'bg-[#fffbeb] text-[#b45309]',
    },
  }
  const statusInfo =
    status && statusMeta[status]
      ? statusMeta[status]
      : { label: status ?? 'Ukendt', className: 'bg-[#f3f4f6] text-[#6b7280]' }

  return (
    <SectionCard icon={CreditCard} title="Abonnement">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-[#6b7280]">Nuværende plan</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-lg font-semibold text-[#111827]">{planLabel}</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}
            >
              {statusInfo.label}
            </span>
          </div>
          {restaurant.current_period_ends_at && (
            <div className="mt-2 text-sm text-[#6b7280]">
              {isActive ? 'Næste betaling' : 'Udløber'}:{' '}
              {formatDanishDate(restaurant.current_period_ends_at)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isActive && (
            <Link
              href="/upgrade"
              className="rounded-lg bg-[#f59e0b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d97706] transition"
            >
              Opgrader
            </Link>
          )}
          <button
            type="button"
            disabled
            className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#6b7280] cursor-not-allowed"
          >
            Administrer abonnement — Kommer snart
          </button>
        </div>
      </div>
    </SectionCard>
  )
}

function AccountSection({ userEmail }: { userEmail: string }) {
  const [pwFeedback, setPwFeedback] = useState<Feedback>(null)
  const [pwPending, startPwTransition] = useTransition()
  const [deletePending, startDeleteTransition] = useTransition()
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handlePasswordSubmit = (formData: FormData) => {
    const newPw = String(formData.get('new_password') ?? '')
    const confirm = String(formData.get('confirm_password') ?? '')
    if (newPw !== confirm) {
      setPwFeedback({ kind: 'err', message: 'De to adgangskoder er ikke ens' })
      return
    }
    if (newPw.length < 6) {
      setPwFeedback({ kind: 'err', message: 'Adgangskoden skal være mindst 6 tegn' })
      return
    }
    setPwFeedback(null)
    startPwTransition(async () => {
      const result = await changePassword(formData)
      if (result.ok) {
        setPwFeedback({ kind: 'ok', message: 'Adgangskoden er opdateret' })
      } else {
        setPwFeedback({ kind: 'err', message: result.error })
      }
    })
  }

  const handleDelete = () => {
    const first = confirm(
      'Er du sikker på, at du vil slette din konto? Alle data (restaurant, borde, bookinger) slettes permanent.'
    )
    if (!first) return
    const second = confirm(
      'Sidste chance. Dette kan ikke fortrydes. Fortsæt med at slette?'
    )
    if (!second) return

    setDeleteError(null)
    startDeleteTransition(async () => {
      try {
        await deleteAccount()
      } catch (e) {
        setDeleteError(e instanceof Error ? e.message : 'Kunne ikke slette konto')
      }
    })
  }

  return (
    <SectionCard icon={User} title="Konto">
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-[#111827]">Skift adgangskode</h3>
          <div className="mt-3">
            <FeedbackBanner feedback={pwFeedback} />
            <form
              action={handlePasswordSubmit}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <div className="sm:col-span-2">
                <Field label="Email" htmlFor="current_email">
                  <input
                    id="current_email"
                    type="email"
                    value={userEmail}
                    readOnly
                    className={`${inputClass} bg-[#f9fafb] text-[#6b7280]`}
                  />
                </Field>
              </div>
              <Field label="Ny adgangskode" htmlFor="new_password">
                <input
                  id="new_password"
                  name="new_password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className={inputClass}
                />
              </Field>
              <Field label="Bekræft adgangskode" htmlFor="confirm_password">
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={pwPending}
                  className="rounded-lg bg-[#f59e0b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d97706] transition disabled:opacity-50"
                >
                  {pwPending ? 'Opdaterer…' : 'Opdater adgangskode'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="rounded-lg border border-[#fecaca] bg-[#fef2f2] p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#b91c1c]">
            <AlertTriangle size={16} />
            Farezone
          </h3>
          <p className="mt-1 text-sm text-[#b91c1c]">
            Sletning af din konto fjerner din restaurant, alle borde og bookinger permanent. Handlingen kan ikke fortrydes.
          </p>
          {deleteError && (
            <div className="mt-3 rounded border border-[#fecaca] bg-white px-3 py-2 text-sm text-[#b91c1c]">
              {deleteError}
            </div>
          )}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deletePending}
              className="rounded-lg bg-[#b91c1c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#991b1b] transition disabled:opacity-50"
            >
              {deletePending ? 'Sletter…' : 'Slet konto'}
            </button>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
