import Link from 'next/link'
import { logout } from '../actions'

export function DashboardHeader({
  restaurantName,
}: {
  restaurantName: string
}) {
  return (
    <header className="border-b border-[#f3f4f6] bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link
          href="/dashboard"
          className="font-logo text-3xl tracking-tight text-[#111827]"
        >
          Napkind
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-[#6b7280] sm:inline">
            {restaurantName}
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#6b7280] hover:text-[#111827] transition"
            >
              Log ud
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
