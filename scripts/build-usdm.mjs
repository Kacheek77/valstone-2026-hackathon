// Builds the map's static drought and county layers (VS-10). Run once, commit
// the output; the app never loads the national files live.
//
//   node scripts/build-usdm.mjs [YYYYMMDD]
//
// Inputs (downloaded to the OS temp folder):
//   - US Drought Monitor weekly GeoJSON, e.g. usdm_20260922.json (~25 MB)
//   - Plotly's Census county GeoJSON (all US counties, ~3 MB)
// Outputs:
//   - public/geo/usdm-<YYYY-MM-DD>.geojson   drought areas D0–D4, property DM
//   - public/geo/region-counties.geojson    every county in the map's box
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import mapshaper from "mapshaper";

const date = process.argv[2] ?? "20260922";
const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
// Map box: the brief asked for lon −105…−97.5, lat 34.3…42.8; widened to
// lon −112…−90, lat 31.5…45.5 so the wide manager view shows no box edge.
const BBOX = "-112,31.5,-90,45.5";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sd-geo-"));

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log(`downloaded ${path.basename(file)} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB)`);
}

const usdmIn = path.join(tmp, "usdm.json");
const countiesIn = path.join(tmp, "counties.json");
await download(`https://droughtmonitor.unl.edu/data/json/usdm_${date}.json`, usdmIn);
await download("https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json", countiesIn);

const usdmOut = `public/geo/usdm-${iso}.geojson`;
await mapshaper.runCommands(
  `-i "${usdmIn}" -clip bbox=${BBOX} -simplify 50% keep-shapes -filter-fields DM ` +
    `-o "${usdmOut}" format=geojson precision=0.0001`,
);

const countiesOut = "public/geo/region-counties.geojson";
await mapshaper.runCommands(
  `-i "${countiesIn}" -clip bbox=${BBOX} -simplify 20% keep-shapes -filter-fields NAME,STATE ` +
    `-o "${countiesOut}" format=geojson precision=0.0001`,
);

for (const f of [usdmOut, countiesOut]) console.log(`${f}: ${(fs.statSync(f).size / 1024).toFixed(0)} KB`);
fs.rmSync(tmp, { recursive: true, force: true });
