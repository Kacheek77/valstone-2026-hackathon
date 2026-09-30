import { countySquare, MAP_HEIGHT, MAP_WIDTH, project, STATE_SHAPES } from "@/lib/geo";

// VS-13 W8: a small static picture of the team map for the Welcome manager
// card: the six territories tinted in their map colours, this week's signals
// as dots. Static on purpose (Welcome makes one small data call).

const TINT: Record<string, string> = {
  "REP-01": "#3a728a",
  "REP-02": "#4b8fae",
  "REP-03": "#5c7a3e",
  "REP-04": "#c64800",
  "REP-05": "#9a3a12",
  "REP-06": "#2c5e73",
};

// The seed's territories (matches public/geo/counties.geojson).
const TERRITORIES: Record<string, string[]> = {
  "REP-01": ["Finney County, KS", "Grant County, KS", "Seward County, KS"],
  "REP-02": ["Thomas County, KS", "Sherman County, KS", "Ford County, KS"],
  "REP-03": ["Perkins County, NE", "Chase County, NE", "Dundy County, NE"],
  "REP-04": ["Texas County, OK", "Beaver County, OK", "Cimarron County, OK"],
  "REP-05": ["Deaf Smith County, TX", "Dallam County, TX", "Moore County, TX"],
  "REP-06": ["Box Butte County, NE", "Cheyenne County, NE", "Keith County, NE"],
};

export type ThumbSignal = { lat: number; lng: number; type: string; severity: string };

function color(s: ThumbSignal): string {
  if (s.type === "drought") return s.severity === "High" ? "#d23b3b" : "#e89b16";
  if (s.type === "rain") return s.severity === "High" ? "#2a6fb5" : "#5b93cc";
  return "#f55a00";
}

export function TeamThumb({ signals }: { signals: ThumbSignal[] }) {
  return (
    <svg viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} className="h-full w-full" role="img" aria-label="The six territories and this week's signals">
      <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#f3f6f8" />
      {STATE_SHAPES.map((s) => (
        <path key={s.name} d={s.d} fill="none" stroke="#bcc4cb" strokeWidth="1.5" />
      ))}
      {Object.entries(TERRITORIES).flatMap(([rep, counties]) =>
        counties.map((c) => {
          const d = countySquare(c);
          return d ? <path key={c} d={d} fill={TINT[rep]} fillOpacity="0.4" stroke={TINT[rep]} strokeWidth="1.5" /> : null;
        }),
      )}
      {signals.map((s, i) => {
        const p = project(s.lat, s.lng);
        return <circle key={i} cx={p.x} cy={p.y} r="9" fill={color(s)} stroke="#fff" strokeWidth="2.5" />;
      })}
    </svg>
  );
}
