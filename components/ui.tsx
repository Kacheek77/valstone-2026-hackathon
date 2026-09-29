import Link from "next/link";
import type { ReactNode } from "react";
import { STAGE_LABEL, type Severity, type SignalType, type Stage } from "@/lib/types";

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[#e3e7eb] bg-white shadow-[0_2px_8px_rgba(15,20,25,0.06)] ${className}`}>
      {children}
    </div>
  );
}

// Every server error renders as one plain sentence in a gray box.
export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="rounded-xl border border-[#d9dee3] bg-[#eef0f2] px-4 py-3 text-sm text-[#3f4e5b]">
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[#bcc4cb] bg-white px-4 py-8 text-center text-sm text-[#5a6975]">
      {children}
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-sm text-[#3a728a] transition-colors duration-150 hover:text-[#142e3a]">
      ← {label}
    </Link>
  );
}

export const SEVERITY_COLOR: Record<Severity, string> = { High: "#d23b3b", Medium: "#e89b16" };
export const SEVERITY_TINT: Record<Severity, string> = { High: "#fbe5e5", Medium: "#fcf1d9" };

export const STAGE_COLOR: Record<Stage, string> = {
  draft: "#7a8794",
  pushed: "#1f9d55",
  sent: "#2a6fb5",
  won: "#1f9d55",
  lost: "#7a8794",
};

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: STAGE_COLOR[stage] }}>
      <span className="h-2 w-2 rounded-full" style={{ background: STAGE_COLOR[stage] }} />
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function SignalIcon({ type, severity }: { type: SignalType; severity: Severity }) {
  const color = SEVERITY_COLOR[severity];
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: SEVERITY_TINT[severity] }}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label={type}>
        {type === "drought" && (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
        {type === "rain" && (
          <>
            <path d="M7 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 17 15Z" />
            <path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3" />
          </>
        )}
        {type === "heat" && <path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0ZM12 9v6" />}
      </svg>
    </div>
  );
}

export function Tile({ label, children, tint = "#f6f7f8" }: { label: ReactNode; children: ReactNode; tint?: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-xl px-4 py-3" style={{ background: tint }}>
      <div className="text-sm text-[#5a6975]">{label}</div>
      {children}
    </div>
  );
}

export function PrimaryButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center whitespace-nowrap rounded-full bg-[#f55a00] px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#d94f00]"
    >
      {children}
    </Link>
  );
}

export function OutlineButtonLink({ href, children, color = "#1f9d55" }: { href: string; children: ReactNode; color?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center whitespace-nowrap rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-opacity duration-150 hover:opacity-80"
      style={{ borderColor: color, color }}
    >
      {children}
    </Link>
  );
}

// Hover or keyboard-focus popover. CSS only, so it works in server components.
export function InfoTip({ label, children, align = "left" }: { label: string; children: ReactNode; align?: "left" | "right" }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#9aa5ae] text-[10px] font-bold leading-none text-[#5a6975] transition-colors duration-150 hover:border-[#3a728a] hover:text-[#3a728a] focus-visible:outline-2 focus-visible:outline-[#3a728a]"
      >
        i
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none invisible absolute top-6 z-40 w-72 rounded-lg border border-[#d9dee3] bg-white px-3 py-2 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-[#3f4e5b] opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${align === "right" ? "right-0" : "left-0"}`}
      >
        {children}
      </span>
    </span>
  );
}

export function StatusBadge({ status }: { status: "Customer" | "Prospect" }) {
  return status === "Customer" ? (
    <span className="rounded-full bg-[#e6f4ec] px-2 py-0.5 text-xs font-medium text-[#14693a]">Customer</span>
  ) : (
    <span className="rounded-full bg-[#fff4ec] px-2 py-0.5 text-xs font-medium text-[#c64800]">Prospect</span>
  );
}
