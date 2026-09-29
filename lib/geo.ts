// Map geometry for the dashboard. Hand-simplified from public state boundary
// coordinates (lng, lat) and bundled here, so the map never fetches anything.

export const MAP_BOUNDS = { west: -104.4, east: -94.3, north: 43.3, south: 32.9 };

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
    label: [-99.9, 42.1],
    ring: [
      [-104.05, 43.0], [-98.5, 43.0], [-97.2, 42.85], [-96.6, 42.5], [-96.4, 42.0],
      [-95.95, 41.5], [-95.85, 41.0], [-95.3, 40.0], [-102.05, 40.0], [-102.05, 41.0],
      [-104.05, 41.0],
    ],
  },
  {
    name: "KANSAS",
    label: [-98.4, 38.7],
    ring: [
      [-102.05, 40.0], [-95.3, 40.0], [-94.9, 39.7], [-94.6, 39.1], [-94.6, 37.0],
      [-102.05, 37.0],
    ],
  },
  {
    name: "OKLAHOMA",
    label: [-97.6, 35.1],
    ring: [
      [-103.0, 37.0], [-94.6, 37.0], [-94.45, 35.4], [-94.45, 33.64], [-95.5, 33.9],
      [-96.5, 33.8], [-97.2, 33.75], [-97.9, 33.9], [-98.5, 34.1], [-99.2, 34.25],
      [-99.7, 34.4], [-100.0, 34.56], [-100.0, 36.5], [-103.0, 36.5],
    ],
  },
  {
    // Texas panhandle and South Plains only, clipped at 98° W and 32.9° N.
    name: "TEXAS",
    label: [-100.2, 33.5],
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

// Approximate centroids for every seeded county ("County, ST" -> [lat, lng]).
export const COUNTY_CENTROIDS: Record<string, [number, number]> = {
  "Finney, KS": [37.99, -100.74],
  "Kearny, KS": [37.99, -101.32],
  "Grant, KS": [37.56, -101.31],
  "Haskell, KS": [37.56, -100.87],
  "Seward, KS": [37.19, -100.85],
  "Texas, OK": [36.75, -101.49],
  "Cimarron, OK": [36.75, -102.52],
  "Deaf Smith, TX": [34.97, -102.6],
  "Parmer, TX": [34.53, -102.78],
  "Douglas, KS": [38.88, -95.29],
  "Franklin, KS": [38.56, -95.29],
  "Shawnee, KS": [39.04, -95.76],
  "Jefferson, KS": [39.24, -95.38],
  "Osage, KS": [38.65, -95.73],
  "Lyon, KS": [38.46, -96.15],
  "Lincoln, NE": [41.05, -100.74],
  "Dawson, NE": [40.87, -99.82],
  "Keith, NE": [41.2, -101.66],
  "Perkins, NE": [40.85, -101.65],
  "Chase, NE": [40.52, -101.7],
  "Saunders, NE": [41.23, -96.64],
  "Butler, NE": [41.23, -97.13],
  "Seward, NE": [40.87, -97.14],
  "York, NE": [40.87, -97.6],
  "Lancaster, NE": [40.78, -96.69],
  "Dodge, NE": [41.58, -96.65],
  "Kingfisher, OK": [35.95, -97.94],
  "Canadian, OK": [35.54, -97.98],
  "Logan, OK": [35.92, -97.44],
  "Grady, OK": [35.02, -97.88],
  "Garfield, OK": [36.38, -97.78],
  "Caddo, OK": [35.17, -98.38],
  "Lubbock, TX": [33.61, -101.82],
  "Hale, TX": [34.07, -101.83],
  "Lamb, TX": [34.07, -102.35],
  "Hockley, TX": [33.61, -102.34],
  "Lynn, TX": [33.18, -101.82],
  "Crosby, TX": [33.61, -101.3],
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
