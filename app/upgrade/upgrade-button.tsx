'use client'

import { useState } from 'react'

export function UpgradeButton({ priceId }: { priceId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!res.ok || !data?.url) {
        throw new Error(data?.error ?? 'Kunne ikke starte checkout')
      }
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noget gik galt')
      setLoading(false)
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full rounded-lg bg-[#f59e0b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#d97706] transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Omdirigerer…' : 'Vælg plan'}
      </button>
      {error && (
        <p className="mt-2 text-xs text-[#b91c1c]">{error}</p>
      )}
    </div>
  )
}
