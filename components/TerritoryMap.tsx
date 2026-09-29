import { countySquare, MAP_HEIGHT, MAP_WIDTH, project, STATE_SHAPES } from "@/lib/geo";
import type { Account, Signal } from "@/lib/types";

function shortLabel(s: Signal): string {
  if (s.type === "drought" && s.drought_level !== null) return `${s.county} · D${s.drought_level}`;
  return `${s.county} · ${s.type}`;
}

export function TerritoryMap({
  territoryCounties,
  accounts,
  repId,
  signals,
}: {
  territoryCounties: string[];
  accounts: Account[];
  repId: number;
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
          const mine = a.rep_id === repId;
          return <circle key={a.id} cx={x} cy={y} r={mine ? 3.5 : 2.5} fill={mine ? "#cee5f3" : "#5a6975"} />;
        })}

        {signals.map((s) => {
          const { x, y } = project(s.lat, s.lng);
          const r = s.severity === "High" ? 28 : 19;
          const core = s.severity === "High" ? "#ff5a5a" : "#ffc24d";
          const labelRight = x < MAP_WIDTH - 130;
          return (
            <a key={s.id} href={`/signals/${s.id}`} aria-label={s.headline} className="cursor-pointer">
              <circle cx={x} cy={y} r={r} fill={`url(#sd-hot-${s.severity})`} />
              <circle cx={x} cy={y} r={r * 0.75} fill="none" stroke={core} strokeWidth="1.5" className="sd-pulse" />
              <circle cx={x} cy={y} r={s.severity === "High" ? 7 : 6} fill={core} stroke="#0f1a24" strokeWidth="2" />
              <text
                x={labelRight ? x + r * 0.6 + 6 : x - r * 0.6 - 6}
                y={y - 8}
                textAnchor={labelRight ? "start" : "end"}
                fill={s.severity === "High" ? "#ffffff" : "#ffc24d"}
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
      {item("#7a8794", "Other rep")}
      <span className="flex items-center gap-1.5 text-[#3a728a]">
        <span className="h-2.5 w-3.5 rounded-sm border border-[#a7cce5] bg-[#4b8fae]/40" />
        Territory
      </span>
    </div>
  );
}
