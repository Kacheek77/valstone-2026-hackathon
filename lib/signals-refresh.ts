import { COUNTY_CENTROIDS } from "./geo";
import { formatId, nextIdNumber, UNIQUE_VIOLATION } from "./ids";
import { getSupabase } from "./supabase";
import { droughtLevel, shortCounty, type Rep, type Signal } from "./types";

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

const LEVEL_NAME = ["Abnormally Dry", "Moderate Drought", "Severe Drought", "Extreme Drought", "Exceptional Drought"];

function mdy(d: Date): string {
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
}

type NewSignal = Omit<Signal, "id">;

// Inserts with SIG- ids, retrying on an id clash from a concurrent insert.
async function insertSignals(rows: NewSignal[]): Promise<string | null> {
  const db = getSupabase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const start = await nextIdNumber("signals", "SIG");
    const { error } = await db
      .from("signals")
      .insert(rows.map((r, i) => ({ id: formatId("SIG", start + i), ...r })));
    if (!error) return null;
    if (error.code !== UNIQUE_VIOLATION) return error.message;
  }
  return "Could not allocate a signal id.";
}

// VS-10: every inserted signal lands in the week the rep sees it: the Monday
// of the current week (US Central). The USDM map date stays in detail/source.
function currentMonday(): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

// The guaranteed demo path: one canned signal in the demo rep's territory,
// inserted once. Seward moved D2 → D3 the week before, so D3 → D4 is plausible.
async function insertDemoSignal(): Promise<RefreshResult> {
  const db = getSupabase();
  const week = currentMonday();
  const { data: existing, error: readErr } = await db
    .from("signals")
    .select("id")
    .eq("county", "Seward County")
    .eq("state", "KS")
    .eq("type", "drought")
    .eq("week_of", week)
    .limit(1);
  if (readErr) return { ok: false, message: `Could not read signals: ${readErr.message}` };
  if (existing && existing.length > 0) {
    return { ok: true, inserted: 0, message: "No new signals. The Seward County drought update is already loaded." };
  }

  const [lat, lng] = COUNTY_CENTROIDS["Seward County, KS"];
  const err = await insertSignals([
    {
      week_of: week,
      county: "Seward County",
      state: "KS",
      // Nudged south of the centroid so it does not sit on this week's Seward rain signal.
      lat: lat - 0.18,
      lng,
      type: "drought",
      severity: "High",
      headline: "Seward, KS moved D3 → D4 (Exceptional Drought)",
      detail:
        "Seward County, KS drought category worsened to D4 (Exceptional Drought) this week, a second weekly step after D2 → D3. Pivot corn is at its last irrigation and well capacity is the constraint.",
      source: "US Drought Monitor (demo signal)",
      target_module: "Irrigation Scheduling",
      status: "new",
      rep_id: "REP-01",
      drought_level: 4,
    },
  ]);
  if (err) return { ok: false, message: `Could not save the new signal: ${err}` };
  return { ok: true, inserted: 1, message: "1 new signal: Seward County, KS moved to D4." };
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

  const owner = new Map<string, string>(); // "Finney County, KS" -> rep id
  for (const r of (reps ?? []) as Rep[]) for (const c of r.counties) owner.set(c, r.id);
  const states = [...new Set([...owner.keys()].map((k) => k.split(", ")[1]))];

  const end = new Date();
  const start = new Date(end.getTime() - 21 * 86_400_000);
  const abort = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let rows: UsdmRow[];
  try {
    rows = (await Promise.all(states.map((s) => fetchState(s, start, end, abort)))).flat();
  } catch (e) {
    const why = e instanceof Error && e.name === "TimeoutError" ? "did not answer within 6 seconds" : "could not be reached";
    return { ok: false, message: `The US Drought Monitor ${why}. Showing the signals already loaded.` };
  }

  const latestStored = new Map<string, Signal>();
  for (const s of (stored ?? []) as Signal[]) {
    const k = `${s.county}, ${s.state}`;
    if (!latestStored.has(k)) latestStored.set(k, s);
  }

  const inserts: NewSignal[] = [];
  for (const [key, repId] of owner) {
    const [county, st] = key.split(", ");
    const history = rows
      .filter((r) => r.state === st && r.county === county)
      .sort((a, b) => b.mapDate.localeCompare(a.mapDate));
    if (history.length === 0) continue;

    const latest = history[0];
    const mapDate = latest.mapDate.slice(0, 10);
    const week = currentMonday();
    const level = levelOf(latest);
    const prev = latestStored.get(key);
    if (prev && prev.week_of >= week) continue; // already have a drought signal this week
    const baseline = (prev && droughtLevel(prev)) ?? (history[1] ? levelOf(history[1]) : level);
    if (level <= baseline || level < 0) continue;

    const centroid = COUNTY_CENTROIDS[key];
    if (!centroid) continue;
    const [lat, lng] = centroid;
    const from = baseline < 0 ? "none" : `D${baseline}`;
    const pct = [latest.d0, latest.d1, latest.d2, latest.d3, latest.d4][level];
    inserts.push({
      week_of: week,
      county,
      state: st,
      lat,
      lng,
      type: "drought",
      severity: level - baseline >= 2 ? "High" : "Medium",
      headline: `${shortCounty(county)}, ${st} moved ${from} → D${level} (${LEVEL_NAME[level]})`,
      detail: `US Drought Monitor map of ${mapDate}: ${pct.toFixed(0)}% of ${county} is at D${level} or worse.`,
      source: `US Drought Monitor (live, map of ${mapDate})`,
      target_module: "Irrigation Scheduling",
      status: "new",
      rep_id: repId,
      drought_level: level,
    });
  }

  if (inserts.length === 0) {
    return { ok: true, inserted: 0, message: "No new signals. Drought categories are unchanged this week." };
  }
  const err = await insertSignals(inserts);
  if (err) return { ok: false, message: `Could not save new signals: ${err}` };
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
