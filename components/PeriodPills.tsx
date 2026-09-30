import Link from "next/link";
import { PERIODS, type PeriodKey } from "@/lib/metrics";

// VS-12 T18: the same Week / Month / Quarter pills on every page.
export function PeriodPills({ current, href }: { current: PeriodKey; href: (key: PeriodKey) => string }) {
  return (
    <nav className="flex gap-2 text-sm" aria-label="Period">
      {PERIODS.map((p) => (
        <Link
          key={p.key}
          href={href(p.key)}
          scroll={false}
          aria-current={p.key === current ? "page" : undefined}
          className={`rounded-full px-4 py-1.5 transition-colors duration-150 ${
            p.key === current ? "bg-[#3a728a] font-medium text-white" : "border border-[#bcc4cb] text-[#3f4e5b] hover:bg-white"
          }`}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
