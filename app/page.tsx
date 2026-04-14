import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-5xl font-bold tracking-tight text-neutral-900">
          Napkind
        </h1>
        <p className="mt-6 text-lg text-neutral-600">
          Det enkle booking system til din restaurant
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800 transition"
          >
            Kom i gang gratis
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-6 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 transition"
          >
            Log ind
          </Link>
        </div>
      </div>
    </main>
  );
}
