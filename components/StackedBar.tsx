import { EXPIRE_DAYS, type Breakdown, type SegmentKey } from "@/lib/metrics";
import { usd, usdExact } from "@/lib/format";

export const SEGMENTS: { key: SegmentKey; label: string; color: string }[] = [
  { key: "won", label: "Won", color: "#1f9d55" },
  { key: "sentOpen", label: "Sent, open", color: "#4b8fae" },
  { key: "pushed", label: "Accepted, not sent", color: "#a7cce5" },
  { key: "draft", label: "Draft", color: "#d9dee3" },
];
// Hatched, so "lost or expired" never reads as the flat gray of Draft.
export const REMAINDER_BG = "repeating-linear-gradient(135deg, #e3e7eb 0 3px, #f6f7f8 3px 7px)";

function remainderTitle(b: Breakdown): string {
  return [
    `Lost or expired: ${usdExact(b.remainder)} expected value`,
    `${b.lost.count} lost (${usdExact(b.lost.amount)} amount)`,
    `${b.expired.count} expired: draft or accepted, created more than ${EXPIRE_DAYS} days ago (${usdExact(b.expired.amount)} amount)`,
    "plus matched accounts on ignored signals that were never generated",
  ].join("\n");
}

// Won % bands (VS-6 ruling): green 15%+, amber 8–14%, red under 8%.
// Team capture-rate bands are separate and unchanged.
export function wonColor(p: number | null): string {
  if (p === null) return "text-[#7a8794]";
  if (p >= 15) return "text-[#1f9d55]";
  if (p >= 8) return "text-[#c47d00]";
  return "text-[#d23b3b]";
}

// One horizontal bar. Its width is this row's available as a share of `scale`
// (the largest available among the bars it is compared with).
export function StackedBar({ b, scale, height = "h-5" }: { b: Breakdown; scale: number; height?: string }) {
  const width = scale > 0 ? Math.max(1.5, (b.available / scale) * 100) : 0;
  if (b.available <= 0) return <div className={`${height} w-full rounded bg-transparent`} />;
  return (
    <div className={`${height} w-full`}>
      <div className="flex h-full overflow-hidden rounded" style={{ width: `${width}%` }}>
        {SEGMENTS.map(({ key, label, color }) => {
          const seg = b.segments[key];
          if (seg.value <= 0) return null;
          return (
            <div
              key={key}
              title={`${label}: ${seg.count} opportunit${seg.count === 1 ? "y" : "ies"}, ${usdExact(seg.value)} expected value (${usdExact(seg.amount)} amount)`}
              className="h-full transition-opacity duration-150 hover:opacity-80"
              style={{ width: `${(seg.value / b.available) * 100}%`, background: color }}
            />
          );
        })}
        {b.remainder > 0 && (
          <div
            title={remainderTitle(b)}
            className="h-full transition-opacity duration-150 hover:opacity-80"
            style={{ width: `${(b.remainder / b.available) * 100}%`, background: REMAINDER_BG }}
          />
        )}
      </div>
    </div>
  );
}

export function BarLegend({ b }: { b: Breakdown }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
      {SEGMENTS.map(({ key, label, color }) => (
        <span key={key} className="flex items-center gap-1.5 text-[#3f4e5b]">
          <span className="h-2.5 w-3.5 rounded-sm" style={{ background: color }} />
          {label} <b className="tabular-nums">{usd(b.segments[key].value)}</b>
        </span>
      ))}
      <span className="flex items-center gap-1.5 text-[#3f4e5b]">
        <span className="h-2.5 w-3.5 rounded-sm border border-[#d9dee3]" style={{ background: REMAINDER_BG }} />
        Lost or expired <b className="tabular-nums">{usd(b.remainder)}</b>
      </span>
      <span className={`font-semibold ${wonColor(b.wonPct)}`}>
        Won {b.wonPct === null ? "—" : `${Math.round(b.wonPct)}%`}
      </span>
    </div>
  );
}
