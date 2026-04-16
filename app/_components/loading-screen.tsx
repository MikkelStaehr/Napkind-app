export function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-white px-6 py-16">
      <style>{`
        @keyframes napkind-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      <div className="flex flex-col items-center gap-6">
        <div className="font-logo text-4xl tracking-tight text-[#111827]">
          Napkind
        </div>
        <div className="h-0.5 w-32 overflow-hidden rounded-full bg-[#f3f4f6]">
          <div
            className="h-full w-full rounded-full bg-[#111827]"
            style={{ animation: 'napkind-progress 1.2s ease-in-out infinite' }}
          />
        </div>
      </div>
    </div>
  )
}
