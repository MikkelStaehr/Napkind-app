'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export function ErrorScreen({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-[#f9fafb] px-6 py-16">
      <div className="w-full max-w-md rounded-xl border border-[#e5e7eb] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fef2f2] text-[#b91c1c]">
          <AlertTriangle size={24} />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-[#111827]">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-[#6b7280]">
          We could not display this page. Try reloading or go back to the dashboard.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-[#f59e0b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d97706] transition"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-2 text-sm font-medium text-[#111827] hover:border-[#111827] transition"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
