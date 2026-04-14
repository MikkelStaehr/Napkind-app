'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export function UpgradedBanner() {
  const [visible, setVisible] = useState(true)
  if (!visible) return null

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-[#a7f3d0] bg-[#ecfdf5] px-4 py-3 text-sm text-[#047857]">
      <span aria-hidden>🎉</span>
      <div className="flex-1">
        <strong className="font-semibold">Velkommen til Napkind Premium!</strong>{' '}
        Dit abonnement er nu aktivt.
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#047857] hover:bg-[#d1fae5] transition"
        aria-label="Luk besked"
      >
        <X size={16} />
      </button>
    </div>
  )
}
