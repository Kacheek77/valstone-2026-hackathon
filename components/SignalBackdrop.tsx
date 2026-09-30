import type { SignalType } from "@/lib/types";

// VS-12 T14: a faint, slow backdrop behind the signal header, by type. CSS and
// inline SVG only, at low opacity so the text keeps its contrast; static under
// prefers-reduced-motion.
export function SignalBackdrop({ type }: { type: SignalType }) {
  if (type === "drought") {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg className="absolute inset-0 h-full w-full opacity-[0.13]" preserveAspectRatio="none" viewBox="0 0 400 120">
          <g fill="none" stroke="#7a4a12" strokeWidth="0.9" strokeLinecap="round">
            <path d="M0 70 L40 64 L62 80 L101 72 L130 90 L170 84" />
            <path d="M62 80 L70 110 M101 72 L112 40 L150 30 L176 44" />
            <path d="M170 84 L210 76 L236 96 L280 88 L300 112 M236 96 L230 120" />
            <path d="M210 76 L220 50 L262 40 L300 58 L340 50 L372 66 L400 60" />
            <path d="M300 58 L310 86 L352 94 L380 118 M150 30 L160 0 M262 40 L256 10" />
            <path d="M0 20 L30 30 L58 18 L90 26 M340 50 L346 22 L380 12" />
          </g>
        </svg>
        <div className="sd-sunrays absolute -right-24 -top-24 h-72 w-72 rounded-full" />
      </div>
    );
  }
  if (type === "rain") return <div aria-hidden className="sd-rain pointer-events-none absolute inset-0" />;
  return <div aria-hidden className="sd-haze pointer-events-none absolute inset-0" />;
}
