import Link from 'next/link'
import { register } from './actions'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; step?: string; email?: string }>
}) {
  const { error, step, email } = await searchParams

  if (step === 'check-email') {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm text-center">
          <Link href="/" className="text-3xl font-bold tracking-tight text-neutral-900">
            Napkind
          </Link>

          <div className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
            <h1 className="text-lg font-semibold text-neutral-900">Bekræft din email</h1>
            <p className="mt-2 text-sm text-neutral-600">
              Vi har sendt en bekræftelses-mail til{' '}
              <span className="font-medium text-neutral-900">{email}</span>.
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              Klik på linket i mailen for at aktivere din konto.
            </p>
          </div>

          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-neutral-900 hover:underline"
          >
            Gå til login
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <Link href="/" className="text-3xl font-bold tracking-tight text-neutral-900">
            Napkind
          </Link>
          <p className="mt-2 text-sm text-neutral-600">Opret din restaurant</p>
        </div>

        <form action={register} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="restaurantName"
              className="block text-sm font-medium text-neutral-700"
            >
              Restaurantens navn
            </label>
            <input
              id="restaurantName"
              name="restaurantName"
              type="text"
              required
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
              Din email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
              Adgangskode
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <p className="mt-1 text-xs text-neutral-500">Mindst 6 tegn</p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition"
          >
            Opret konto
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-600">
          Har du allerede en konto?{' '}
          <Link href="/login" className="font-medium text-neutral-900 hover:underline">
            Log ind
          </Link>
        </p>
      </div>
    </main>
  )
}
