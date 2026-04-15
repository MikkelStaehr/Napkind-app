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
          <Link href="/" className="font-logo text-6xl tracking-tight text-neutral-900 sm:text-7xl">
            Napkind
          </Link>

          <div className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 p-6">
            <h1 className="text-lg font-semibold text-neutral-900">Confirm your email</h1>
            <p className="mt-2 text-sm text-neutral-600">
              We&apos;ve sent a confirmation email to{' '}
              <span className="font-medium text-neutral-900">{email}</span>.
            </p>
            <p className="mt-2 text-sm text-neutral-600">
              Click the link in the email to activate your account.
            </p>
          </div>

          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-neutral-900 hover:underline"
          >
            Go to log in
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <Link href="/" className="font-logo text-6xl tracking-tight text-neutral-900 sm:text-7xl">
            Napkind
          </Link>
          <p className="mt-2 text-sm text-neutral-600">Create your restaurant</p>
        </div>

        <form action={register} className="mt-8 space-y-4">
          <div>
            <label
              htmlFor="restaurantName"
              className="block text-sm font-medium text-neutral-700"
            >
              Restaurant name
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
              Your email
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
              Password
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
            <p className="mt-1 text-xs text-neutral-500">At least 6 characters</p>
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
            Create account
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-600">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-neutral-900 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  )
}
