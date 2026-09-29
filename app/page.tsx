import Link from "next/link";
import { BrandMark } from "@/components/Header";
import { RepEntry } from "@/components/RepEntry";

// Static: no data calls, so the root URL always loads.
export const dynamic = "force-static";

const REPO_URL = "https://github.com/Kacheek77/valstone-2026-hackathon";

function InfoCard({ title, tone, children }: { title: string; tone: "plain" | "solution"; children: React.ReactNode }) {
  const styles = {
    plain: { bg: "#f6f7f8", bar: "#3a728a", text: "#3a728a" },
    solution: { bg: "#e6f4ec", bar: "#1f9d55", text: "#1f9d55" },
  }[tone];
  return (
    <div className="flex flex-col gap-2 rounded-xl border-t-[5px] px-5 py-4" style={{ background: styles.bg, borderColor: styles.bar }}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: styles.text }}>
        {title}
      </p>
      <div className="text-[15px] leading-relaxed text-[#3f4e5b]">{children}</div>
    </div>
  );
}

// Final copy (her voice pass, 2026-09-29).
export default function Welcome() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-8 sm:px-6">
      <div className="overflow-hidden rounded-xl bg-white shadow-[0_8px_24px_rgba(15,20,25,0.12)]">
        <div className="flex flex-col gap-3 bg-gradient-to-r from-[#142e3a] to-[#3a728a] px-6 py-7 sm:px-9">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <BrandMark className="h-7 w-7" />
            <p className="text-xl font-bold text-white">Signal Desk</p>
            <p className="text-sm text-[#cee5f3]">· Valstone Fall Summit 2026 Hackathon · Problem 1, Sales</p>
          </div>
          <h1 className="max-w-4xl text-2xl font-bold leading-snug text-white sm:text-3xl">
            The weather changes what every farm needs this week.
            <br />
            Signal Desk automates capturing and pursuing that opportunity.
          </h1>
        </div>

        <div className="flex flex-col gap-4 px-6 py-6 sm:px-9">
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard title="The business" tone="plain">
              <p>ThiboLiSoft&apos;s FieldSense software for crop growers comprises three products:</p>
              <ul className="my-2 list-disc pl-5 font-semibold">
                <li>Irrigation Scheduling</li>
                <li>Field-Work Planner</li>
                <li>Yield &amp; Insurance Records</li>
              </ul>
              <p>Each product is utilized in the week the weather turns and affects the farm.</p>
            </InfoCard>
            <InfoCard title="Our solution" tone="solution">
              <p>
                Signal Desk removes the need for sales reps to manually search territories and automates their outreach after
                weather events.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Reads county weather reports and flags drought, heavy rain and significant weather events</li>
                <li>Matches affected accounts by crop and FieldSense module gap</li>
                <li>Scores each one and writes why now and the outreach email</li>
                <li>One click creates the opportunity and tasks and initiates the sales workflow</li>
              </ul>
            </InfoCard>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex flex-wrap items-center gap-3">
              {/* Plain <a>: /view sets a cookie, so it must never be prefetched. */}
              <a
                href="/view?as=manager"
                className="rounded-full bg-[#f55a00] px-5 py-2.5 text-sm font-bold text-white transition-colors duration-150 hover:bg-[#d94f00]"
              >
                Enter as manager →
              </a>
              <RepEntry />
            </div>
            <div className="flex flex-wrap gap-5 text-sm">
              <Link href="/terms" className="text-[#3a728a] underline underline-offset-2 hover:text-[#142e3a]">
                Terminology
              </Link>
              <Link href="/about" className="text-[#3a728a] underline underline-offset-2 hover:text-[#142e3a]">
                What is real vs. seeded
              </Link>
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-[#3a728a] underline underline-offset-2 hover:text-[#142e3a]">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
