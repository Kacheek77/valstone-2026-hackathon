// The map's static GeoJSON (public/geo), fetched once per page. Kept out of
// SignalMap so SignalMapLoader can start the downloads while the MapLibre
// bundle is still loading (VS-11 item 4).

// US Drought Monitor, week of the map (scripts/build-usdm.mjs).
export const USDM_DATE = "2026-09-22";

export const GEO_FILES = ["counties.geojson", "states.geojson", `usdm-${USDM_DATE}.geojson`, "region-counties.geojson"] as const;

const cache = new Map<string, Promise<unknown>>();

export function geoJson(file: string): Promise<unknown> {
  if (!cache.has(file)) {
    cache.set(
      file,
      fetch(`/geo/${file}`).then((r) => {
        if (!r.ok) throw new Error(`${file}: ${r.status}`);
        return r.json();
      }),
    );
  }
  return cache.get(file)!;
}

export function prefetchMapGeo(): void {
  for (const f of GEO_FILES) void geoJson(f).catch(() => {}); // the map shows its own error
}
