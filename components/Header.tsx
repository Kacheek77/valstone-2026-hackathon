import Link from "next/link";
import type { Rep } from "@/lib/types";
import type { View } from "@/lib/view";
import { ViewSwitcher } from "./ViewSwitcher";

export function BrandMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#f55a00" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12h4l3-8 6 16 3-8h4" />
    </svg>
  );
}

const FALLBACK_REPS = [
  "Jordan Ellsworth", "Priya Nathan", "Marcus Deleon", "Renee Okafor", "Tyler Bramlett", "Sofia Marchetti",
].map((name, i) => ({ id: `REP-0${i + 1}`, name }));

export function Header({
  view,
  reps,
  active,
  selected,
}: {
  view: View;
  reps: Pick<Rep, "id" | "name" | "is_manager" | "voice_note">[] | null;
  active: "dashboard" | "team" | "pipeline" | "results" | null;
  // Which switcher entry to show; defaults to the cookie view.
  selected?: string;
}) {
  // Header still works (with placeholder names) when the database is down.
  const repList = reps ? reps.filter((r) => !r.is_manager) : FALLBACK_REPS;
  const options = [
    { value: "manager", label: "Manager · Plains" },
    ...repList.map((r) => ({ value: r.id, label: r.name })),
  ];
  const current = selected ?? (view.kind === "manager" ? "manager" : view.repId);
  const home = view.kind === "manager" ? { href: "/team", label: "Team", key: "team" } : { href: "/dashboard", label: "Dashboard", key: "dashboard" };

  const navItem = (href: string, label: string, key: string) => (
    <Link
      key={key}
      href={href}
      className={`border-b-2 pb-0.5 text-sm transition-colors duration-150 ${
        active === key ? "border-[#f55a00] font-semibold text-white" : "border-transparent text-[#cee5f3] hover:text-white"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="bg-gradient-to-r from-[#142e3a] to-[#3a728a]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-white">
          <BrandMark />
          Signal Desk
        </Link>
        <nav className="flex items-center gap-5">
          {navItem(home.href, home.label, home.key)}
          {navItem("/pipeline", "Pipeline", "pipeline")}
          {navItem("/results", "Results", "results")}
          <ViewSwitcher
            options={options}
            selected={current}
            voice={
              current !== "manager" && reps
                ? { repId: current, note: reps.find((r) => r.id === current)?.voice_note ?? null }
                : null
            }
          />
        </nav>
      </div>
    </header>
  );
}
