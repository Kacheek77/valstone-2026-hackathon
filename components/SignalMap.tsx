"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MapAccount, MapData, MapRep, MapSignal } from "@/lib/mapData";
import { faSvg } from "./faIcons";

// VS-8: MapLibre map with county boundaries, signal areas, account and signal
// markers, hover popups and a click drawer. Approved from the mockup
// "From LC Claude/map-options.html".

type Feature = { type: "Feature"; id?: string; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };
type FC = { type: "FeatureCollection"; features: Feature[] };

export type MapMode = "rep" | "manager";
type Basemap = "map" | "topo";
type Selection = { kind: "signal" | "account" | "rep"; id: string } | null;

const TINT: Record<string, string> = {
  "REP-01": "#3a728a",
  "REP-02": "#4b8fae",
  "REP-03": "#5c7a3e",
  "REP-04": "#c64800",
  "REP-05": "#9a3a12",
  "REP-06": "#2c5e73",
};
const FA_TYPE = { drought: "sun-plant-wilt", rain: "cloud-showers-heavy", heat: "temperature-arrow-up" } as const;
const TYPE_LABEL = { drought: "Drought", rain: "Rain", heat: "Heat" } as const;
const STAGE_WORD: Record<string, string> = { draft: "draft", pushed: "accepted", sent: "sent", won: "won", lost: "lost" };
const STAGE_BG: Record<string, string> = { draft: "#7a8794", pushed: "#3a728a", sent: "#1f9d55", won: "#1f9d55", lost: "#9a3a12" };

export function signalColor(s: Pick<MapSignal, "type" | "severity">): string {
  if (s.type === "drought") return s.severity === "High" ? "#d23b3b" : "#e89b16";
  if (s.type === "rain") return s.severity === "High" ? "#2a6fb5" : "#5b93cc";
  return "#f55a00";
}

// MapLibre resolves its worker next to its own chunk, which the bundler moves;
// serve it from public/maplibre (copied there by the prebuild script).
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const POSITRON = "https://tiles.openfreemap.org/styles/positron";
const USGS_TOPO: StyleSpecification = {
  version: 8,
  sources: {
    b: {
      type: "raster",
      tiles: ["https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 16,
      attribution: "USGS The National Map",
    },
  },
  layers: [{ id: "b", type: "raster", source: "b" }],
};
const BLANK: StyleSpecification = { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#eef2f5" } }] };
const STYLE_TIMEOUT_MS = 4000;
const MANAGER_PIN_ZOOM = 7.2;

// Fetch the vector style ourselves with a 4 s timeout; on failure use a blank
// background so the county layers and markers still show.
async function loadStyle(basemap: Basemap, forceOffline: boolean): Promise<{ style: StyleSpecification; offline: boolean }> {
  if (forceOffline) return { style: BLANK, offline: true };
  if (basemap === "topo") return { style: USGS_TOPO, offline: false };
  try {
    const url = process.env.NEXT_PUBLIC_MAP_STYLE_URL || POSITRON;
    const res = await fetch(url, { signal: AbortSignal.timeout(STYLE_TIMEOUT_MS) });
    if (!res.ok) throw new Error(String(res.status));
    return { style: (await res.json()) as StyleSpecification, offline: false };
  } catch {
    return { style: BLANK, offline: true };
  }
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function bbox(features: Feature[]): [[number, number], [number, number]] {
  const b: [[number, number], [number, number]] = [[180, 90], [-180, -90]];
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as number[];
      b[0][0] = Math.min(b[0][0], x);
      b[0][1] = Math.min(b[0][1], y);
      b[1][0] = Math.max(b[1][0], x);
      b[1][1] = Math.max(b[1][1], y);
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  features.forEach((f) => walk(f.geometry.coordinates));
  return b;
}

const short = (county: string) => county.replace(/ County$/, "");
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function signalAreas(signals: MapSignal[], counties: FC, reps: MapRep[]): FC {
  const key = (c: string, st: string) => `${c}, ${st}`;
  const byKey = new Map(counties.features.map((f) => [key(String(f.properties.county), String(f.properties.state)), f]));
  const direct = new Set(signals.map((s) => key(s.county, s.state)));
  const features: Feature[] = [];
  for (const s of signals) {
    const f = byKey.get(key(s.county, s.state));
    if (!f) continue;
    const color = signalColor(s);
    features.push({ type: "Feature", geometry: f.geometry, properties: { sid: s.id, color, strength: 1 } });
    // Spread to neighbours: the rest of the territory, as the matcher treats it.
    const rep = reps.find((r) => r.id === s.repId);
    for (const c of rep?.counties ?? []) {
      if (direct.has(c)) continue;
      const nf = byKey.get(c);
      if (nf) features.push({ type: "Feature", geometry: nf.geometry, properties: { sid: s.id, color, strength: 0.35 } });
    }
  }
  return { type: "FeatureCollection", features };
}

// ---------------------------------------------------------------- drawer

function Tag({ stage, n }: { stage: string; n?: number }) {
  return (
    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: STAGE_BG[stage] ?? "#3a728a" }}>
      {n !== undefined ? `${n} ` : ""}
      {STAGE_WORD[stage] ?? stage}
    </span>
  );
}

function Icon({ name, size = 14, color }: { name: string; size?: number; color?: string }) {
  return <span className="inline-block align-[-2px]" dangerouslySetInnerHTML={{ __html: faSvg(name, size, color) }} />;
}

function Kv({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div className="my-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <span className="text-[#5a6975]">{k}</span>
          <span className="break-words">{v}</span>
        </div>
      ))}
    </div>
  );
}

const btn = "flex items-center gap-2.5 rounded-md border-2 px-3.5 py-2 text-sm font-bold transition-opacity duration-150 hover:opacity-85";
const btnPrimary = `${btn} border-[#f55a00] bg-[#f55a00] text-white`;
const btnSecondary = `${btn} border-[#3a728a] bg-white text-[#3a728a]`;
const btnQuiet = "flex items-center gap-2.5 px-3.5 py-1 text-sm text-[#5a6975] hover:underline";

function SignalCard({ s, reps }: { s: MapSignal; reps: MapRep[] }) {
  const color = signalColor(s);
  const rep = reps.find((r) => r.id === s.repId);
  const week = new Date(`${s.week}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const sourceUrl = s.type === "drought" ? `https://droughtmonitor.unl.edu/CurrentMap/StateDroughtMonitor.aspx?${s.state}` : "https://www.weather.gov/";
  return (
    <>
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: color }}>
          <Icon name={FA_TYPE[s.type]} size={16} color="#fff" />
        </span>
        <div>
          <h2 className="text-lg font-bold">
            {TYPE_LABEL[s.type]} · {s.severity}
          </h2>
          <p className="text-[13px] text-[#5a6975]">
            {short(s.county)}, {s.state} · week of {week} · {s.source}
          </p>
        </div>
      </div>
      <div className="my-2 rounded-lg bg-[#f6f7f8] px-3 py-2.5 text-[13px] leading-relaxed">
        <b>{s.headline}</b>
        <br />
        {s.detail}
      </div>
      <Kv
        rows={[
          ["Lead with", s.module],
          ["Rep", rep?.name ?? "—"],
          ["Accounts matched", s.matches],
          [
            "Leads generated",
            s.n ? (
              <span className="flex flex-wrap items-center gap-1">
                {s.n} · {money(s.amount)}{" "}
                {Object.entries(s.stages).map(([k, v]) => (
                  <Tag key={k} stage={k} n={v} />
                ))}
              </span>
            ) : (
              <span className="text-[#c64800]">none yet</span>
            ),
          ],
        ]}
      />
      <div className="mt-3 flex flex-col gap-2">
        <Link href={`/signals/${s.id}`} className={btnPrimary}>
          <Icon name="wand-magic-sparkles" color="#fff" />
          {s.n ? "Open signal" : "Score & generate leads"}
        </Link>
        <Link href={`/pipeline?signal=${s.id}`} className={btnSecondary}>
          <Icon name="table-list" color="#3a728a" />
          Pipeline for this signal
        </Link>
        <a href={sourceUrl} target="_blank" rel="noreferrer" className={btnQuiet}>
          <Icon name="arrow-up-right-from-square" color="#5a6975" />
          Source: {s.source}
        </a>
      </div>
    </>
  );
}

function AccountCard({ a, reps }: { a: MapAccount; reps: MapRep[] }) {
  const rep = reps.find((r) => r.id === a.repId);
  const first = a.contact.split(" ")[0] || "contact";
  return (
    <>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Icon name={a.status === "Prospect" ? "seedling" : "tractor"} size={16} color="#3a728a" /> {a.name}
      </h2>
      <p className="text-[13px] text-[#5a6975]">
        {a.county}, {a.state} · <b style={{ color: a.status === "Customer" ? "#1f9d55" : "#c64800" }}>{a.status}</b> · {rep?.name ?? "—"}
      </p>
      <Kv
        rows={[
          [
            "Contact",
            <span key="c">
              {a.contact}
              {a.role ? `, ${a.role}` : ""}
              {a.email && (
                <>
                  <br />
                  <span className="text-[#5a6975]">{a.email}</span>
                </>
              )}
            </span>,
          ],
          ["Crops", a.crops],
          ["Acres", a.acres.toLocaleString("en-US")],
          ["Owns", a.owns],
          ["Last contact", a.lastContact ?? "—"],
        ]}
      />
      {a.note && (
        <div className="my-2 flex gap-2 rounded-lg bg-[#f6f7f8] px-3 py-2.5 text-[13px] leading-relaxed">
          <Icon name="comment-dots" color="#3a728a" /> <span>{a.note}</span>
        </div>
      )}
      <p className="mt-3 text-xs uppercase tracking-wider text-[#5a6975]">This period</p>
      {a.current.length === 0 ? (
        <p className="border-t border-[#d9dee3] py-2 text-[13px] text-[#5a6975]">No lead this period</p>
      ) : (
        a.current.map((o) => (
          <div key={o.id} className="flex items-center justify-between border-t border-[#d9dee3] py-2 text-[13px]">
            <span>
              <b>{o.lead}</b>
              <br />
              <span className="text-[#5a6975]">
                {o.id} · score {o.score}
              </span>
            </span>
            <span className="text-right">
              {money(o.amount)}
              <br />
              <Tag stage={o.stage} />
            </span>
          </div>
        ))
      )}
      <div className="mt-3 flex flex-col gap-2">
        {a.current.map((o) => (
          <Link key={o.id} href={`/opportunities/${o.id}`} className={btnPrimary}>
            <Icon name="envelope-open-text" color="#fff" />
            Open opportunity · {o.lead}
          </Link>
        ))}
        <Link href={`/pipeline?q=${encodeURIComponent(a.name)}`} className={btnSecondary}>
          <Icon name="table-list" color="#3a728a" />
          Pipeline (filtered to this account)
        </Link>
        {a.email && (
          <a href={`mailto:${a.email}`} className={btnQuiet}>
            <Icon name="paper-plane" color="#5a6975" />
            Email {first}
          </a>
        )}
      </div>
    </>
  );
}

function RepCard({ r, data }: { r: MapRep; data: MapData }) {
  const sigs = data.signals.filter((s) => s.repId === r.id);
  const accts = data.accounts.filter((a) => a.repId === r.id);
  const generated = sigs.reduce((n, s) => n + s.n, 0);
  const ignored = sigs.filter((s) => !s.n).length;
  return (
    <>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Icon name="user" size={16} color={TINT[r.id] ?? "#3a728a"} /> {r.name}
      </h2>
      <p className="text-[13px] text-[#5a6975]">
        {r.territory} · {r.counties.map((c) => short(c.split(",")[0])).join(" · ")}
      </p>
      <Kv
        rows={[
          ["Accounts", `${accts.length} (${accts.filter((a) => a.status === "Customer").length} customers)`],
          ["Signals", sigs.length],
          ["Leads generated", generated],
          ["Signals untouched", <span key="u" style={{ color: ignored ? "#c64800" : "#1f9d55" }}>{ignored}</span>],
        ]}
      />
      {sigs.map((s) => (
        <div key={s.id} className="flex items-center justify-between gap-2 border-t border-[#d9dee3] py-2 text-[13px]">
          <span className="flex items-center gap-1.5">
            <Icon name={FA_TYPE[s.type]} color={signalColor(s)} /> {s.headline}
          </span>
          <span>{s.n || <span className="text-[#c64800]">0</span>}</span>
        </div>
      ))}
      <div className="mt-3 flex flex-col gap-2">
        <Link href={`/team/${r.id}`} className={btnPrimary}>
          <Icon name="users" color="#fff" />
          Open {r.name.split(" ")[0]}&apos;s summary
        </Link>
        <Link href={`/results?rep=${r.id}`} className={btnSecondary}>
          <Icon name="chart-line" color="#3a728a" />
          Results for {r.name.split(" ")[0]}
        </Link>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- SVG fallback (no WebGL)

function SvgFallback({ counties, states, data, mode, repId }: { counties: FC; states: FC; data: MapData; mode: MapMode; repId: string | null }) {
  const focus = mode === "manager" ? counties.features : counties.features.filter((f) => f.properties.rep_id === repId);
  const [[w, s], [e, n]] = bbox(focus.length ? focus : counties.features);
  const pad = 0.4;
  const W = 600;
  const H = 440;
  const sx = W / (e - w + 2 * pad);
  const sy = H / (n - s + 2 * pad);
  const k = Math.min(sx, sy);
  const x = (lng: number) => (lng - w + pad) * k;
  const y = (lat: number) => (n + pad - lat) * k;
  const path = (f: Feature) => {
    const polys = f.geometry.type === "MultiPolygon" ? (f.geometry.coordinates as number[][][][]) : [f.geometry.coordinates as number[][][]];
    return polys.map((p) => p.map((ring) => ring.map(([a, b], i) => `${i ? "L" : "M"}${x(a).toFixed(1)} ${y(b).toFixed(1)}`).join(" ") + "Z").join(" ")).join(" ");
  };
  const areas = signalAreas(data.signals, counties, data.reps);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="County outlines and signal areas (offline map)">
      <rect width={W} height={H} fill="#eef2f5" />
      {counties.features.map((f) => (
        <path key={String(f.properties.fips)} d={path(f)} fill={mode === "manager" ? TINT[String(f.properties.rep_id)] ?? "#999" : "#3a728a"} fillOpacity={mode === "manager" ? 0.22 : f.properties.rep_id === repId ? 0.2 : 0.03} />
      ))}
      {areas.features.map((f, i) => (
        <path key={i} d={path(f)} fill={String(f.properties.color)} fillOpacity={0.45 * Number(f.properties.strength)} stroke={String(f.properties.color)} strokeDasharray="4 3" />
      ))}
      {counties.features.map((f) => (
        <path key={`l${String(f.properties.fips)}`} d={path(f)} fill="none" stroke="#3a728a" strokeWidth={1} />
      ))}
      {states.features.map((f, i) => (
        <path key={`s${i}`} d={path(f)} fill="none" stroke="#142e3a" strokeOpacity={0.7} strokeWidth={1.4} />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------- map

export default function SignalMap({
  data,
  mode,
  repId,
  layout,
  height = 480,
}: {
  data: MapData;
  mode: MapMode;
  repId: string | null;
  layout: "beside" | "under";
  height?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  // Client-only component (loaded with ssr: false), so browser APIs are safe in
  // the initial state: the remembered basemap and the WebGL check.
  const [basemap, setBasemap] = useState<Basemap>(() => {
    try {
      return localStorage.getItem("sd-basemap") === "topo" ? "topo" : "map";
    } catch {
      return "map"; // Storage blocked: keep the default.
    }
  });
  const [offline, setOffline] = useState(false);
  const [noWebgl, setNoWebgl] = useState(() => !webglAvailable());
  const [geo, setGeo] = useState<{ counties: FC; states: FC } | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [selected, setSelected] = useState<Selection>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/geo/counties.geojson").then((r) => r.json()), fetch("/geo/states.geojson").then((r) => r.json())])
      .then(([counties, states]) => !cancelled && setGeo({ counties, states }))
      .catch(() => !cancelled && setGeoError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const areas = useMemo(() => (geo ? signalAreas(data.signals, geo.counties, data.reps) : null), [geo, data]);

  useEffect(() => {
    if (!geo || !areas || !container.current || noWebgl) return;
    let map: maplibregl.Map | null = null;
    let cancelled = false;
    const markers: maplibregl.Marker[] = [];
    const t0 = performance.now();
    const manager = mode === "manager";
    const forceOffline = new URLSearchParams(window.location.search).get("map") === "offline-test";

    (async () => {
      const { style, offline: off } = await loadStyle(basemap, forceOffline);
      if (cancelled || !container.current) return;
      setOffline(off);
      const focus = manager ? geo.counties.features : geo.counties.features.filter((f) => f.properties.rep_id === repId);
      const bounds = bbox(focus.length ? focus : geo.counties.features);
      try {
        map = new maplibregl.Map({
          container: container.current,
          style,
          bounds,
          fitBoundsOptions: { padding: 50 },
          attributionControl: { compact: true },
        });
      } catch {
        setNoWebgl(true);
        return;
      }
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      // Diagnostics hook: lets a click-through inspect layers and timing.
      (window as unknown as { __sdMap?: maplibregl.Map }).__sdMap = map;
      map.on("error", (e) => console.warn("map error:", e.error?.message ?? e));
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: "sd-tip" });
      const tip = (lngLat: maplibregl.LngLatLike, html: string) => popup.setLngLat(lngLat).setHTML(html).addTo(map!);
      const untip = () => popup.remove();

      const zoomClass = () => container.current?.classList.toggle("sd-zoomed-out", map!.getZoom() < MANAGER_PIN_ZOOM);
      map.on("zoom", zoomClass);

      map.once("idle", () => {
        (window as unknown as { __mapTiming?: object }).__mapTiming = {
          basemap: off ? "blank (offline)" : basemap,
          idleMs: Math.round(performance.now() - t0),
        };
      });

      map.on("load", () => {
        if (!map) return;
        // Re-fit once the container has its real size (it can still be settling
        // when the map is created, which leaves the view zoomed out).
        map.resize();
        map.fitBounds(bounds, { padding: 50, duration: 0 });
        zoomClass();
        map.addSource("states", { type: "geojson", data: geo.states as never });
        map.addSource("counties", { type: "geojson", data: geo.counties as never });
        map.addSource("areas", { type: "geojson", data: areas as never });
        map.addLayer({ id: "states-line", type: "line", source: "states", paint: { "line-color": "#142e3a", "line-width": 1.6, "line-opacity": 0.7 } });
        map.addLayer({
          id: "terr-fill",
          type: "fill",
          source: "counties",
          paint: manager
            ? { "fill-color": ["match", ["get", "rep_id"], ...Object.entries(TINT).flat(), "#999999"] as never, "fill-opacity": 0.22 }
            : { "fill-color": "#3a728a", "fill-opacity": ["case", ["==", ["get", "rep_id"], repId ?? ""], 0.2, 0.03] as never },
        });
        map.addLayer({ id: "sig-fill", type: "fill", source: "areas", paint: { "fill-color": ["get", "color"], "fill-opacity": ["*", ["get", "strength"], 0.45] } });
        map.addLayer({
          id: "sig-line",
          type: "line",
          source: "areas",
          paint: { "line-color": ["get", "color"], "line-width": ["*", ["get", "strength"], 3], "line-dasharray": [2, 1.5], "line-opacity": ["get", "strength"] },
        });
        map.addLayer({
          id: "county-line",
          type: "line",
          source: "counties",
          paint: { "line-color": "#3a728a", "line-width": manager ? 1 : ["case", ["==", ["get", "rep_id"], repId ?? ""], 2, 1] as never, "line-opacity": 0.85 },
        });

        const byId = new Map(data.signals.map((s) => [s.id, s]));
        // A point is "on a signal" only where the signal's own county is; the
        // spread-to-neighbours tint is context. In manager view a click there
        // falls through to the territory (rep card).
        const directSignal = (point: maplibregl.PointLike) =>
          map!.queryRenderedFeatures(point, { layers: ["sig-fill"] }).find((f) => Number(f.properties?.strength) >= 1);
        map.on("mousemove", "sig-fill", (e) => {
          const hit = manager ? directSignal(e.point) : e.features?.[0];
          if (!hit) return;
          const sid = String(hit.properties?.sid ?? "");
          const s = byId.get(sid);
          if (!s) return;
          map!.getCanvas().style.cursor = "pointer";
          tip(e.lngLat, `<b>${esc(s.headline)}</b><br><span style="color:#5a6975">Click for details</span>`);
        });
        map.on("mouseleave", "sig-fill", () => {
          map!.getCanvas().style.cursor = "";
          untip();
        });
        map.on("click", "sig-fill", (e) => {
          const hit = manager ? directSignal(e.point) : e.features?.[0];
          const sid = String(hit?.properties?.sid ?? "");
          if (byId.has(sid)) setSelected({ kind: "signal", id: sid });
        });

        if (manager) {
          map.on("mousemove", "terr-fill", (e) => {
            if (directSignal(e.point)) return;
            const rid = String(e.features?.[0]?.properties?.rep_id ?? "");
            const r = data.reps.find((x) => x.id === rid);
            if (!r) return;
            const n = data.signals.filter((s) => s.repId === rid).length;
            const a = data.accounts.filter((x) => x.repId === rid).length;
            map!.getCanvas().style.cursor = "pointer";
            tip(e.lngLat, `<b>${esc(r.name)}</b> · ${esc(r.territory)}<br>${n} signal${n === 1 ? "" : "s"} · ${a} accounts<br><span style="color:#5a6975">Click for the rep card</span>`);
          });
          map.on("mouseleave", "terr-fill", () => {
            map!.getCanvas().style.cursor = "";
            untip();
          });
          map.on("click", "terr-fill", (e) => {
            if (directSignal(e.point)) return;
            const rid = String(e.features?.[0]?.properties?.rep_id ?? "");
            if (rid) setSelected({ kind: "rep", id: rid });
          });
        }

        // Account pins: tractor = customer, seedling = prospect.
        for (const a of data.accounts) {
          const other = !manager && a.repId !== repId;
          const el = document.createElement("div");
          el.className = `sd-acct${a.status === "Prospect" ? " prospect" : ""}${other ? " other" : ""}${a.openLead && !other ? " hot" : ""}`;
          el.innerHTML = faSvg(a.status === "Prospect" ? "seedling" : "tractor", manager ? 8 : 10);
          el.addEventListener("mouseenter", () =>
            tip(
              [a.lng, a.lat],
              `<b>${esc(a.name)}</b><br>${a.status} · ${esc(a.crops)} · ${a.acres.toLocaleString("en-US")} ac${
                a.current.length ? `<br><span style="color:#f55a00">${a.current.length} lead${a.current.length > 1 ? "s" : ""} this period</span>` : ""
              }`,
            ),
          );
          el.addEventListener("mouseleave", untip);
          el.addEventListener("click", (ev) => {
            ev.stopPropagation();
            setSelected({ kind: "account", id: a.id });
          });
          markers.push(new maplibregl.Marker({ element: el }).setLngLat([a.lng, a.lat]).addTo(map));
        }

        // Signal icons; High pulses.
        for (const s of data.signals) {
          if (!manager && s.repId !== repId) continue;
          const el = document.createElement("div");
          el.className = `sd-sig ${s.severity}`;
          el.style.background = signalColor(s);
          el.style.color = signalColor(s);
          el.innerHTML = faSvg(FA_TYPE[s.type], manager ? 13 : s.severity === "High" ? 19 : 16, "#fff");
          el.addEventListener("mouseenter", () =>
            tip(
              [s.lng, s.lat],
              `<b>${esc(s.headline)}</b><br>${s.severity} · ${
                s.n ? `${s.n} lead${s.n > 1 ? "s" : ""} generated` : `${s.matches} matching accounts, nothing generated yet`
              }`,
            ),
          );
          el.addEventListener("mouseleave", untip);
          el.addEventListener("click", (ev) => {
            ev.stopPropagation();
            setSelected({ kind: "signal", id: s.id });
          });
          markers.push(new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map));
        }
      });
    })();

    return () => {
      cancelled = true;
      markers.forEach((m) => m.remove());
      map?.remove();
    };
  }, [geo, areas, basemap, data, mode, repId, noWebgl]);

  const chooseBasemap = (b: Basemap) => {
    setBasemap(b);
    try {
      localStorage.setItem("sd-basemap", b);
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
  };

  const sel =
    selected?.kind === "signal"
      ? data.signals.find((s) => s.id === selected.id)
      : selected?.kind === "account"
        ? data.accounts.find((a) => a.id === selected.id)
        : selected?.kind === "rep"
          ? data.reps.find((r) => r.id === selected.id)
          : undefined;

  const drawer = (
    <aside
      className={`relative rounded-xl border border-[#d9dee3] bg-white p-4 ${layout === "beside" ? "overflow-auto" : ""}`}
      style={layout === "beside" ? { height } : undefined}
      aria-live="polite"
    >
      {selected && sel ? (
        <>
          <button
            type="button"
            onClick={() => setSelected(null)}
            aria-label="Close"
            className="absolute right-3 top-3 rounded p-1 text-[#5a6975] hover:bg-[#f6f7f8]"
          >
            <Icon name="xmark" size={14} color="#5a6975" />
          </button>
          {selected.kind === "signal" && <SignalCard s={sel as MapSignal} reps={data.reps} />}
          {selected.kind === "account" && <AccountCard a={sel as MapAccount} reps={data.reps} />}
          {selected.kind === "rep" && <RepCard r={sel as MapRep} data={data} />}
        </>
      ) : (
        <div className="text-sm leading-relaxed text-[#5a6975]">
          <span className="mb-2 block">
            <Icon name="hand-pointer" size={24} color="#3a728a" />
          </span>
          Click a signal icon, a shaded county, an account pin{mode === "manager" ? ", or a territory" : ""} for the facts and the next
          step. Hover for the short version.
        </div>
      )}
    </aside>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className={layout === "beside" ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]" : "flex flex-col gap-4"}>
        <div
          className={`relative overflow-hidden rounded-xl bg-[#dfe6ec] shadow-[0_8px_24px_rgba(15,20,25,0.12)] ${mode === "manager" ? "sd-mgr" : ""}`}
          style={{ height }}
        >
          {noWebgl || geoError ? (
            geo ? (
              <SvgFallback counties={geo.counties} states={geo.states} data={data} mode={mode} repId={repId} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[#5a6975]">The map could not load on this network.</div>
            )
          ) : (
            <div ref={container} className={`h-full w-full ${mode === "manager" ? "sd-mgr" : ""}`} />
          )}
          <div className="absolute left-3 top-3 z-10 flex overflow-hidden rounded-full border border-[#bcc4cb] bg-white text-xs shadow-sm">
            {(["map", "topo"] as Basemap[]).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => chooseBasemap(b)}
                aria-pressed={basemap === b}
                className={`px-3 py-1 font-semibold transition-colors duration-150 ${basemap === b ? "bg-[#3a728a] text-white" : "text-[#3f4e5b] hover:bg-[#f6f7f8]"}`}
              >
                {b === "map" ? "Map" : "Topo"}
              </button>
            ))}
          </div>
          {(offline || noWebgl) && (
            <span className="absolute bottom-3 left-3 z-10 rounded bg-[#eef0f2] px-2 py-0.5 text-xs text-[#5a6975]">offline map</span>
          )}
        </div>
        {drawer}
      </div>
      <MapLegend />
    </div>
  );
}

function MapLegend() {
  const sw = (bg: string, label: string) => (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-3 w-5 rounded-sm" style={{ background: bg }} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-[#3f4e5b]">
      {sw("#d23b3b", "Drought, High (pulses)")}
      {sw("#e89b16", "Drought, Medium")}
      {sw("#f55a00", "Heat")}
      {sw("#2a6fb5", "Rain")}
      <span className="flex items-center gap-1.5">
        <Icon name="tractor" color="#3a728a" /> Customer
      </span>
      <span className="flex items-center gap-1.5">
        <Icon name="seedling" color="#3a728a" /> Prospect
      </span>
      {sw("rgba(58,114,138,0.3)", "Territory")}
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full bg-white shadow-[0_0_0_2px_#f55a00]" /> Account with an open lead
      </span>
    </div>
  );
}
