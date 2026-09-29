import { COUNTY_CENTROIDS } from "./geo";
import { getSupabase } from "./supabase";
import type { Rep, Signal } from "./types";

export type RefreshResult =
  | { ok: true; inserted: number; message: string }
  | { ok: false; message: string };

const USDM =
  "https://usdmdataservices.unl.edu/api/CountyStatistics/GetDroughtSeverityStatisticsByAreaPercent";
const FETCH_TIMEOUT_MS = 6_000;

type UsdmRow = {
  mapDate: string;
  county: string; // "Finney County"
  state: string; // "KS"
  d0: number;
  d1: number;
  d2: number;
  d3: number;
  d4: number;
};

// Cumulative area percentages: the county's category is the highest D level
// covering at least half its area. -1 means no drought.
function levelOf(r: UsdmRow): number {
  const pct = [r.d0, r.d1, r.d2, r.d3, r.d4];
  for (let n = 4; n >= 0; n--) if (pct[n] >= 50) return n;
  return -1;
}

const LEVEL_NAME = ["abnormally dry", "moderate drought", "severe drought", "extreme drought", "exceptional drought"];
const STATE_NAME: Record<string, string> = { KS: "Kansas", NE: "Nebraska", OK: "Oklahoma", TX: "Texas" };

function mdy(d: Date): string {
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
}

async function latestWeek(): Promise<string | null> {
  const { data } = await getSupabase()
    .from("signals")
    .select("week_of")
    .order("week_of", { ascending: false })
    .limit(1);
  return data?.[0]?.week_of ?? null;
}

// The guaranteed demo path: one canned signal, inserted once.
async function insertDemoSignal(): Promise<RefreshResult> {
  const db = getSupabase();
  const week = (await latestWeek()) ?? new Date().toISOString().slice(0, 10);
  const { data: existing, error: readErr } = await db
    .from("signals")
    .select("id")
    .eq("county", "Kearny")
    .eq("state", "KS")
    .eq("type", "drought")
    .eq("week_of", week)
    .limit(1);
  if (readErr) return { ok: false, message: `Could not read signals: ${readErr.message}` };
  if (existing && existing.length > 0) {
    return { ok: true, inserted: 0, message: "No new signals. The Kearny County update is already loaded." };
  }

  const [lat, lng] = COUNTY_CENTROIDS["Kearny, KS"];
  const { error } = await db.from("signals").insert({
    week_of: week,
    county: "Kearny",
    state: "KS",
    lat,
    lng,
    type: "drought",
    severity: "Medium",
    headline: "Kearny County, Kansas moved from D1 to D2 (severe drought)",
    detail:
      "Drought spread west from Finney County this week. Pivot corn along the Arkansas River is near its last irrigation, and ditch deliveries are being cut.",
    source: "US Drought Monitor (demo signal)",
    status: "new",
    rep_id: 1,
    drought_level: 2,
  });
  if (error) return { ok: false, message: `Could not save the new signal: ${error.message}` };
  return { ok: true, inserted: 1, message: "1 new signal: Kearny County, KS moved to D2." };
}

async function fetchState(state: string, start: Date, end: Date, signal: AbortSignal): Promise<UsdmRow[]> {
  const url = `${USDM}?aoi=${state}&startdate=${mdy(start)}&enddate=${mdy(end)}&statisticsType=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal, cache: "no-store" });
  if (!res.ok) throw new Error(`USDM returned ${res.status} for ${state}`);
  return (await res.json()) as UsdmRow[];
}

// The real path: US Drought Monitor county categories for every territory
// county. A signal is inserted only when the category rose versus the stored
// latest (or, with nothing stored, versus the previous USDM week).
async function refreshFromUsdm(): Promise<RefreshResult> {
  const db = getSupabase();
  const [{ data: reps, error: repErr }, { data: stored, error: sigErr }] = await Promise.all([
    db.from("reps").select("*"),
    db.from("signals").select("*").eq("type", "drought").order("week_of", { ascending: false }),
  ]);
  if (repErr || sigErr) {
    return { ok: false, message: `Could not read the database: ${(repErr ?? sigErr)!.message}` };
  }

  const owner = new Map<string, number>();
  for (const r of (reps ?? []) as Rep[]) for (const c of r.counties) owner.set(c, r.id);
  const states = [...new Set([...owner.keys()].map((k) => k.split(", ")[1]))];

  const end = new Date();
  const start = new Date(end.getTime() - 21 * 86_400_000);
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let rows: UsdmRow[];
  try {
    rows = (await Promise.all(states.map((s) => fetchState(s, start, end, signal)))).flat();
  } catch (e) {
    const why = e instanceof Error && e.name === "TimeoutError" ? "did not answer within 6 seconds" : "could not be reached";
    return { ok: false, message: `The US Drought Monitor ${why}. Showing the signals already loaded.` };
  }

  const latestStored = new Map<string, Signal>();
  for (const s of (stored ?? []) as Signal[]) {
    const k = `${s.county}, ${s.state}`;
    if (!latestStored.has(k)) latestStored.set(k, s);
  }

  const inserts = [];
  for (const [key, repId] of owner) {
    const [county, st] = key.split(", ");
    const history = rows
      .filter((r) => r.state === st && r.county === `${county} County`)
      .sort((a, b) => b.mapDate.localeCompare(a.mapDate));
    if (history.length === 0) continue;

    const latest = history[0];
    const week = latest.mapDate.slice(0, 10);
    const level = levelOf(latest);
    const prev = latestStored.get(key);
    if (prev && prev.week_of >= week) continue; // already have this week or newer
    const baseline = prev?.drought_level ?? (history[1] ? levelOf(history[1]) : level);
    if (level <= baseline || level < 0) continue;

    const centroid = COUNTY_CENTROIDS[key];
    if (!centroid) continue;
    const [lat, lng] = centroid;
    const from = baseline < 0 ? "no drought" : `D${baseline}`;
    const pct = [latest.d0, latest.d1, latest.d2, latest.d3, latest.d4][level];
    inserts.push({
      week_of: week,
      county,
      state: st,
      lat,
      lng,
      type: "drought",
      severity: level - Math.max(baseline, -1) >= 2 ? "High" : "Medium",
      headline: `${county} County, ${STATE_NAME[st] ?? st} moved from ${from} to D${level} (${LEVEL_NAME[level]})`,
      detail: `US Drought Monitor map of ${week}: ${pct.toFixed(0)}% of the county is at D${level} or worse.`,
      source: "US Drought Monitor (live)",
      status: "new",
      rep_id: repId,
      drought_level: level,
    });
  }

  if (inserts.length === 0) {
    return { ok: true, inserted: 0, message: "No new signals. Drought categories are unchanged this week." };
  }
  const { error } = await db.from("signals").insert(inserts);
  if (error) return { ok: false, message: `Could not save new signals: ${error.message}` };
  return {
    ok: true,
    inserted: inserts.length,
    message: `${inserts.length} new signal${inserts.length === 1 ? "" : "s"} from the US Drought Monitor.`,
  };
}

export async function refreshSignals(opts: { demo: boolean }): Promise<RefreshResult> {
  try {
    return opts.demo ? await insertDemoSignal() : await refreshFromUsdm();
  } catch (e) {
    return { ok: false, message: `Refresh failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
