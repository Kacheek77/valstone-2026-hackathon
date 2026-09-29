"use client";

import { useState } from "react";

// Static on purpose: Welcome makes no data calls. Matches the seed's reps.
const REPS = [
  { id: "REP-01", name: "Jordan Ellsworth", territory: "Southwest Kansas" },
  { id: "REP-02", name: "Priya Nathan", territory: "Northwest & Central Kansas" },
  { id: "REP-03", name: "Marcus Deleon", territory: "Southwest Nebraska" },
  { id: "REP-04", name: "Renee Okafor", territory: "Oklahoma Panhandle" },
  { id: "REP-05", name: "Tyler Bramlett", territory: "Texas Panhandle" },
  { id: "REP-06", name: "Sofia Marchetti", territory: "Nebraska Panhandle" },
];

export function RepEntry() {
  const [rep, setRep] = useState(REPS[0].id);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative">
        <span className="sr-only">Enter as a rep</span>
        <select
          value={rep}
          onChange={(e) => setRep(e.target.value)}
          className="cursor-pointer appearance-none rounded-full border-2 border-[#3a728a] bg-white py-2 pl-4 pr-9 text-sm font-bold text-[#3a728a] outline-none transition-colors duration-150 hover:bg-[#f6f7f8] focus-visible:ring-2 focus-visible:ring-[#f55a00]"
        >
          {REPS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · {r.territory}
            </option>
          ))}
        </select>
        <span aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-[#3a728a]">
          ▾
        </span>
      </label>
      {/* Plain <a>: /view sets the sd_view cookie, so it must never be prefetched. */}
      <a
        href={`/view?as=${rep}`}
        className="rounded-full border-2 border-[#3a728a] px-4 py-2 text-sm font-bold text-[#3a728a] transition-colors duration-150 hover:bg-[#3a728a] hover:text-white"
      >
        Enter as a rep →
      </a>
    </div>
  );
}
