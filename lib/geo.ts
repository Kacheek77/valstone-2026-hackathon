// Map geometry for the dashboard. Hand-simplified from public state boundary
// coordinates (lng, lat) and bundled here, so the map never fetches anything.

// Cropped to the six territories: NE/KS/OK west of 96.5° W, TX panhandle north of 34.3° N.
export const MAP_BOUNDS = { west: -104.4, east: -96.5, north: 43.3, south: 34.3 };

// Pixels per degree. Longitude is scaled by cos(38°) so shapes are not stretched.
const PX_LAT = 56;
const PX_LNG = PX_LAT * Math.cos((38 * Math.PI) / 180);

export const MAP_WIDTH = Math.round((MAP_BOUNDS.east - MAP_BOUNDS.west) * PX_LNG);
export const MAP_HEIGHT = Math.round((MAP_BOUNDS.north - MAP_BOUNDS.south) * PX_LAT);

export function project(lat: number, lng: number): { x: number; y: number } {
  return {
    x: (lng - MAP_BOUNDS.west) * PX_LNG,
    y: (MAP_BOUNDS.north - lat) * PX_LAT,
  };
}

type Ring = [number, number][]; // [lng, lat]

const STATES: { name: string; label: [number, number]; ring: Ring }[] = [
  {
    name: "NEBRASKA",
    label: [-98.9, 42.3],
    ring: [
      [-104.05, 43.0], [-98.5, 43.0], [-97.2, 42.85], [-96.6, 42.5], [-96.4, 42.0],
      [-95.95, 41.5], [-95.85, 41.0], [-95.3, 40.0], [-102.05, 40.0], [-102.05, 41.0],
      [-104.05, 41.0],
    ],
  },
  {
    name: "KANSAS",
    label: [-98.2, 38.5],
    ring: [
      [-102.05, 40.0], [-95.3, 40.0], [-94.9, 39.7], [-94.6, 39.1], [-94.6, 37.0],
      [-102.05, 37.0],
    ],
  },
  {
    name: "OKLAHOMA",
    label: [-98.2, 35.6],
    ring: [
      [-103.0, 37.0], [-94.6, 37.0], [-94.45, 35.4], [-94.45, 33.64], [-95.5, 33.9],
      [-96.5, 33.8], [-97.2, 33.75], [-97.9, 33.9], [-98.5, 34.1], [-99.2, 34.25],
      [-99.7, 34.4], [-100.0, 34.56], [-100.0, 36.5], [-103.0, 36.5],
    ],
  },
  {
    // Texas panhandle only; the map's south edge crops the rest.
    name: "TEXAS",
    label: [-100.9, 34.55],
    ring: [
      [-103.04, 36.5], [-100.0, 36.5], [-100.0, 34.56], [-99.7, 34.4], [-99.2, 34.25],
      [-98.5, 34.1], [-98.0, 33.95], [-98.0, 32.9], [-103.06, 32.9],
    ],
  },
];

function ringPath(ring: Ring): string {
  return (
    ring
      .map(([lng, lat], i) => {
        const { x, y } = project(lat, lng);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
}

export const STATE_SHAPES = STATES.map((s) => {
  const { x, y } = project(s.label[1], s.label[0]);
  return { name: s.name, d: ringPath(s.ring), labelX: x, labelY: y };
});

// Centroids for the 18 territory counties ("County, ST" -> [lat, lng]), from
// the supplied seed: signals.csv where the county has a signal, otherwise the
// mean of its accounts in accounts.csv.
export const COUNTY_CENTROIDS: Record<string, [number, number]> = {
  "Finney County, KS": [38.04, -100.74],
  "Grant County, KS": [37.56, -101.31],
  "Seward County, KS": [37.19, -100.85],
  "Thomas County, KS": [39.4, -100.99],
  "Sherman County, KS": [39.35, -101.72],
  "Ford County, KS": [37.69, -99.89],
  "Perkins County, NE": [40.85, -101.65],
  "Chase County, NE": [40.52, -101.7],
  "Dundy County, NE": [40.18, -101.69],
  "Texas County, OK": [36.74, -101.45],
  "Beaver County, OK": [36.75, -100.48],
  "Cimarron County, OK": [36.75, -102.52],
  "Deaf Smith County, TX": [34.97, -102.6],
  "Dallam County, TX": [36.28, -102.6],
  "Moore County, TX": [35.84, -101.89],
  "Box Butte County, NE": [42.18, -103.15],
  "Cheyenne County, NE": [41.22, -102.99],
  "Keith County, NE": [41.2, -101.66],
};

// Each county drawn as a ~0.5° square around its centroid: close to the real
// size of a Plains county, and enough to shade a territory honestly.
export function countySquare(key: string): string | null {
  const c = COUNTY_CENTROIDS[key];
  if (!c) return null;
  const [lat, lng] = c;
  const h = 0.24;
  return ringPath([
    [lng - h * 1.1, lat + h],
    [lng + h * 1.1, lat + h],
    [lng + h * 1.1, lat - h],
    [lng - h * 1.1, lat - h],
  ]);
}
