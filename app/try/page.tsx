import Link from "next/link";
import { BrandMark } from "@/components/Header";
import { TryClient } from "@/components/TryClient";
import FIXTURES from "@/lib/try-fixtures.json";
import type { TryOutput } from "@/lib/tryChips";

// VS-13 TRY: every chip answers instantly from a reviewed fixture; free text
// and "Regenerate live" call Claude. Static page, phone first.
export const dynamic = "force-static";

export const metadata = { title: "Try it with your company" };

export default function TryPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-5 sm:px-6 sm:py-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-[#142e3a]">
          <BrandMark className="h-6 w-6" color="#3a728a" />
          Signal Desk
        </Link>
        <Link href="/" className="text-sm text-[#3a728a] underline underline-offset-2">
          See the full demo →
        </Link>
      </div>

      <h1 className="text-2xl font-bold leading-tight text-[#142e3a] sm:text-3xl">Try it with your company</h1>
      <p className="mb-5 mt-2 text-[15px] leading-relaxed text-[#3f4e5b]">
        Signal Desk watches public events that change what your customers need, finds the accounts they hit, scores them and
        writes the outreach. Pick a Valstone company, or describe a business. Every answer is an illustrative example with
        fictional customers.
      </p>

      <TryClient fixtures={FIXTURES as unknown as Record<string, TryOutput>} />

      <footer className="mt-10 border-t border-[#e3e7eb] pt-4 text-sm text-[#7a8794]">Built by Team Force Majeure</footer>
    </main>
  );
}
