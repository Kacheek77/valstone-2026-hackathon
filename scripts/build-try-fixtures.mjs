// Builds lib/try-fixtures.json (VS-13 TRY): one reviewed answer per company
// chip, so the /try chips answer instantly and work if Claude is down.
//
//   npx next dev -p 3931            (with ANTHROPIC_API_KEY in .env.local)
//   node scripts/build-try-fixtures.mjs [http://localhost:3931] [chip-id ...]
//
// Calls the app's own /api/try, so fixtures come from the same prompt as live
// answers. Existing entries are kept unless their chip id is passed.
import fs from "node:fs";

const base = process.argv[2]?.startsWith("http") ? process.argv[2] : "http://localhost:3931";
const only = process.argv.slice(2).filter((a) => !a.startsWith("http"));
const file = "lib/try-fixtures.json";
const fixtures = JSON.parse(fs.readFileSync(file, "utf-8"));
const src = fs.readFileSync("lib/tryChips.ts", "utf-8");
const ids = [...src.matchAll(/\{ id: "([^"]+)"/g)].map((m) => m[1]);

for (const id of ids) {
  if (fixtures[id] && !only.includes(id)) continue;
  if (only.length && !only.includes(id)) continue;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t0 = Date.now();
    const res = await fetch(`${base}/api/try`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chip: id }) });
    const j = await res.json();
    if (j.ok) {
      fixtures[id] = j.output;
      console.log(`${id}: ok in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      break;
    }
    console.log(`${id}: attempt ${attempt} failed (${j.error})`);
  }
  fs.writeFileSync(file, JSON.stringify(fixtures, null, 2) + "\n");
}
console.log(`${Object.keys(fixtures).length} of ${ids.length} chips have fixtures`);
