import Link from "next/link";
import { BrandMark } from "@/components/Header";
import { DEMO_REP_ID } from "@/lib/view";

// Static: no data calls, so the root URL always loads.
export const dynamic = "force-static";

const REPO_URL = "https://github.com/Kacheek77/valstone-2026-hackathon";

function InfoCard({ title, children, tone }: { title: string; children: React.ReactNode; tone: "plain" | "problem" | "solution" }) {
  const styles = {
    plain: { bg: "#f6f7f8", bar: "#3a728a", text: "#3a728a" },
    problem: { bg: "#fff4ec", bar: "#f55a00", text: "#c64800" },
    solution: { bg: "#e6f4ec", bar: "#1f9d55", text: "#1f9d55" },
  }[tone];
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border-t-[5px] px-5 py-4" style={{ background: styles.bg, borderColor: styles.bar }}>
      <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: styles.text }}>
        {title}
      </p>
      <p className="text-[15px] leading-relaxed text-[#3f4e5b]">{children}</p>
    </div>
  );
}

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
            The weather changes what every farm needs this week. Signal Desk turns that into a ready-to-send Salesforce
            opportunity, with no admin.
          </h1>
        </div>

        <div className="flex flex-col gap-4 px-6 py-6 sm:px-9">
          <div className="grid gap-4 md:grid-cols-2">
            <InfoCard title="The business" tone="plain">
              ThiboLiSoft sells FieldSense, farm-operations software for crop growers, with agronomy services attached. Sales
              run in Salesforce across the Plains states.
            </InfoCard>
            <InfoCard title="The products" tone="plain">
              <b>Irrigation Scheduling</b> (drought) · <b>Field-Work Planner</b> (excess rain) ·{" "}
              <b>Yield &amp; Insurance Records</b> (heat, hail, frost). Each one is urgent in the week the weather turns.
            </InfoCard>
            <InfoCard title="The problem" tone="problem">
              Reps prospect from a territory list that looks the same in a drought as in a flood. Matching weather to accounts
              is manual, and every lead costs twenty minutes of CRM typing. The CEO asked for more opportunities, faster deals,
              and no admin.
            </InfoCard>
            <InfoCard title="Our solution" tone="solution">
              Read county weather weekly → match affected accounts by crop and module gap → Claude scores each one and writes
              why now and the email → one click creates the Opportunity and Task in Salesforce. Managers see performance
              against the opportunity the weather created.
            </InfoCard>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            {/* Plain <a>: /view sets a cookie, so it must never be prefetched. */}
            <div className="flex flex-wrap gap-3">
              <a
                href="/view?as=manager"
                className="rounded-full bg-[#f55a00] px-5 py-2.5 text-sm font-bold text-white transition-colors duration-150 hover:bg-[#d94f00]"
              >
                Enter as manager →
              </a>
              <a
                href={`/view?as=${DEMO_REP_ID}`}
                className="rounded-full border-2 border-[#3a728a] px-5 py-2 text-sm font-bold text-[#3a728a] transition-colors duration-150 hover:bg-[#3a728a] hover:text-white"
              >
                Enter as a rep (Jordan) →
              </a>
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
