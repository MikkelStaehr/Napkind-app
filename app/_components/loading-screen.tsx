import { UtensilsCrossed } from 'lucide-react'

export function LoadingScreen({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-white px-6 py-16">
      <style>{`
        @keyframes napkind-plate-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes napkind-plate-breathe {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.04); opacity: 0.85; }
        }
        @keyframes napkind-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-3px); opacity: 1; }
        }
      `}</style>

      <div className="flex flex-col items-center gap-8">
        <div
          className="relative h-32 w-32"
          style={{
            animation: 'napkind-plate-breathe 2.2s ease-in-out infinite',
          }}
        >
          <div className="absolute inset-0 rounded-full border-[3px] border-[#e5e7eb] bg-white shadow-sm" />
          <div className="absolute inset-3 rounded-full border border-[#f3f4f6]" />
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              animation: 'napkind-plate-spin 3.6s linear infinite',
            }}
          >
            <UtensilsCrossed
              size={48}
              strokeWidth={1.25}
              className="text-[#111827]"
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="font-logo text-3xl tracking-tight text-[#111827]">
            Napkind
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs uppercase tracking-[0.2em] text-[#6b7280]">
              {label}
            </span>
            <span className="flex items-end gap-0.5">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="inline-block h-1 w-1 rounded-full bg-[#6b7280]"
                  style={{
                    animation: `napkind-dot-bounce 1.2s ease-in-out ${delay}ms infinite`,
                  }}
                />
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
