import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 bg-white">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-5xl font-bold tracking-tight text-[#111827]">
          Napkind
        </h1>
        <p className="mt-6 text-lg text-[#6b7280]">
          Det enkle booking system til din restaurant
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-lg bg-[#111827] px-6 py-3 text-sm font-medium text-white hover:bg-[#1f2937] transition"
          >
            Kom i gang gratis
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-[#111827] bg-white px-6 py-3 text-sm font-medium text-[#111827] hover:bg-[#f9fafb] transition"
          >
            Log ind
          </Link>
        </div>
      </div>
    </main>
  );
}
