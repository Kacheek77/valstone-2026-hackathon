"use client";

import Link from "next/link";

// Last-resort boundary: an unexpected server error renders as one plain
// sentence in a gray box, never a crash page.
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-16">
      <div className="rounded-xl border border-[#d9dee3] bg-[#eef0f2] px-6 py-8 text-center">
        <p className="font-semibold">Something went wrong loading this page.</p>
        <div className="mt-4 flex justify-center gap-4 text-sm">
          <button type="button" onClick={reset} className="text-[#3a728a] underline">
            Try again
          </button>
          <Link href="/" className="text-[#3a728a] underline">Welcome</Link>
        </div>
      </div>
    </main>
  );
}
