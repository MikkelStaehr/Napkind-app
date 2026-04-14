import Link from 'next/link'
import { login } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <Link href="/" className="font-logo text-6xl tracking-tight text-neutral-900 sm:text-7xl">
            Napkind
          </Link>
          <p className="mt-2 text-sm text-neutral-600">Log ind på din konto</p>
        </div>

        <form action={login} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
              Email
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
              autoComplete="current-password"
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-700 select-none">
            <input
              type="checkbox"
              name="remember_me"
              className="h-4 w-4 rounded border-neutral-300 text-[#f59e0b] focus:ring-[#f59e0b]"
            />
            Husk mig
          </label>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition"
          >
            Log ind
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-600">
          Har du ikke en konto?{' '}
          <Link href="/register" className="font-medium text-neutral-900 hover:underline">
            Opret en
          </Link>
        </p>
      </div>
    </main>
  )
}
