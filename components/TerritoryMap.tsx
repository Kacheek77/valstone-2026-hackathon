import { countySquare, MAP_HEIGHT, MAP_WIDTH, project, STATE_SHAPES } from "@/lib/geo";
import { droughtLevel, shortCounty, type Account, type Signal } from "@/lib/types";

function shortLabel(s: Signal): string {
  const level = droughtLevel(s);
  return `${shortCounty(s.county)} · ${level !== null ? `D${level}` : s.type}`;
}

type Placed = { s: Signal; x: number; y: number; r: number; lx: number; ly: number; anchor: "start" | "end"; leader: boolean };

// Hotspots in one territory sit close together, so labels are placed in a
// column beside the cluster, at least 17px apart, with a leader line back to
// the hotspot whenever a label had to move.
function placeLabels(signals: Signal[]): Placed[] {
  const pts = signals
    .map((s) => ({ s, ...project(s.lat, s.lng), r: s.severity === "High" ? 28 : 19 }))
    .sort((a, b) => a.y - b.y);
  const placed: Placed[] = [];
  for (const p of pts) {
    const near = pts.filter((q) => Math.abs(q.x - p.x) < 70 && Math.abs(q.y - p.y) < 70);
    const right = Math.max(...near.map((q) => q.x + q.r * 0.55)) + 10;
    const anchor: "start" | "end" = right + 120 < MAP_WIDTH ? "start" : "end";
    const lx = anchor === "start" ? right : Math.min(...near.map((q) => q.x - q.r * 0.55)) - 10;
    let ly = p.y + 4;
    for (const prev of placed) {
      if (prev.anchor === anchor && Math.abs(prev.lx - lx) < 140 && ly < prev.ly + 17 && ly > prev.ly - 17) ly = prev.ly + 17;
    }
    const leader = Math.abs(ly - (p.y + 4)) > 3 || Math.abs(lx - p.x) > p.r * 0.55 + 14;
    placed.push({ s: p.s, x: p.x, y: p.y, r: p.r, lx, ly, anchor, leader });
  }
  return placed;
}

export function TerritoryMap({
  territoryCounties,
  accounts,
  repId,
  signals,
}: {
  territoryCounties: string[];
  accounts: Account[];
  repId: string;
  signals: Signal[];
}) {
  const territory = territoryCounties.map(countySquare).filter(Boolean).join(" ");

  return (
    <div className="overflow-hidden rounded-xl bg-gradient-to-b from-[#0f1a24] to-[#142e3a]">
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="block h-auto w-full"
        role="img"
        aria-label="Map of Nebraska, Kansas, Oklahoma and the Texas panhandle with the territory shaded, account dots, and this week's signals as hotspots"
      >
        <defs>
          <pattern id="sd-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0 L0 0 0 24" fill="none" stroke="#1f3a4a" strokeWidth="1" />
          </pattern>
          <radialGradient id="sd-hot-High">
            <stop offset="0%" stopColor="#ff5a5a" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#d23b3b" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#d23b3b" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sd-hot-Medium">
            <stop offset="0%" stopColor="#ffc24d" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#e89b16" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#e89b16" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#sd-grid)" />

        {STATE_SHAPES.map((s) => (
          <path key={s.name} d={s.d} fill="#16303f" stroke="#4b8fae" strokeWidth="1.5" strokeLinejoin="round" />
        ))}
        {STATE_SHAPES.map((s) => (
          <text key={`${s.name}-label`} x={s.labelX} y={s.labelY} fill="#4b8fae" fontSize="13" letterSpacing="3" textAnchor="middle">
            {s.name}
          </text>
        ))}

        {territory && (
          <path d={territory} fill="#4b8fae" fillOpacity="0.4" stroke="#a7cce5" strokeWidth="1" strokeOpacity="0.7" />
        )}

        {accounts.map((a) => {
          const { x, y } = project(a.lat, a.lng);
          if (a.rep_id !== repId) return null; // only the rep's own accounts
          return <circle key={a.id} cx={x} cy={y} r={3.5} fill="#cee5f3" />;
        })}

        {placeLabels(signals).map(({ s, x, y, r, lx, ly, anchor, leader }) => {
          const core = s.severity === "High" ? "#ff5a5a" : "#ffc24d";
          return (
            <a key={s.id} href={`/signals/${s.id}`} aria-label={s.headline} className="cursor-pointer">
              <circle cx={x} cy={y} r={r} fill={`url(#sd-hot-${s.severity})`} />
              <circle cx={x} cy={y} r={r * 0.75} fill="none" stroke={core} strokeWidth="1.5" className="sd-pulse" />
              <circle cx={x} cy={y} r={s.severity === "High" ? 7 : 6} fill={core} stroke="#0f1a24" strokeWidth="2" />
              {leader && (
                <path
                  d={`M${x} ${y} L${anchor === "start" ? lx - 3 : lx + 3} ${ly - 4}`}
                  stroke="#a7cce5"
                  strokeOpacity="0.8"
                  strokeWidth="1"
                  fill="none"
                />
              )}
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                fill={s.severity === "High" ? "#ffffff" : "#ffc24d"}
                stroke="#0f1a24"
                strokeWidth="3"
                paintOrder="stroke"
                fontSize="13"
                fontWeight="700"
              >
                {shortLabel(s)}
              </text>
            </a>
          );
        })}
      </svg>
    </div>
  );
}

export function MapLegend() {
  const item = (color: string, label: string, bold = false) => (
    <span className={`flex items-center gap-1.5 ${bold ? "font-semibold" : ""}`} style={{ color }}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {item("#d23b3b", "High", true)}
      {item("#e89b16", "Medium", true)}
      {item("#3a728a", "My account")}
      <span className="flex items-center gap-1.5 text-[#3a728a]">
        <span className="h-2.5 w-3.5 rounded-sm border border-[#a7cce5] bg-[#4b8fae]/40" />
        Territory
      </span>
    </div>
  );
}
