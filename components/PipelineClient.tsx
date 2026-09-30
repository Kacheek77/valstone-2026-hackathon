"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { STAGE_LABEL, type Stage } from "@/lib/types";

export type PipelineRow = {
  id: string;
  score: number;
  lead: boolean; // at or above threshold, or promoted
  promoted: boolean;
  account: string;
  county: string;
  status: "Customer" | "Prospect";
  rep: string;
  signalId: string | null;
  signalLabel: string; // "Finney, KS · D2 → D3 · Sep 28" or "List prospecting"
  headline: string;
  module: string;
  amount: number;
  stage: Stage;
  created: string; // ISO
  createdLabel: string;
  signalDriven: boolean;
  steps: string | null; // "2/4 steps"
};

export type SignalOption = { id: string; label: string };

const STAGES: ("all" | Stage)[] = ["all", "draft", "pushed", "sent", "won"];
const OPEN: Stage[] = ["draft", "pushed", "sent"];
const MODULES = ["Irrigation Scheduling", "Field-Work Planner", "Yield & Insurance Records"];
const LIST = "__list__";

const STAGE_COLOR: Record<Stage, string> = {
  draft: "#7a8794",
  pushed: "#1f9d55",
  sent: "#2a6fb5",
  won: "#1f9d55",
  lost: "#7a8794",
};

type SortKey = "score" | "amount" | "created";

function usd(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-[#5a6975]">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[#d9dee3] bg-white px-2 py-1 text-sm text-[#0f1419] outline-none focus:border-[#3a728a]"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PipelineClient({
  rows,
  signalOptions,
  reps,
  manager,
  initialSignal,
  initialQuery = "",
}: {
  rows: PipelineRow[];
  signalOptions: SignalOption[];
  reps: string[];
  manager: boolean;
  initialSignal: string | null;
  initialQuery?: string;
}) {
  const [stage, setStage] = useState<"all" | Stage>("all");
  const [showBelow, setShowBelow] = useState(false);
  const [q, setQ] = useState(initialQuery);
  const [module, setModule] = useState("");
  const [signal, setSignal] = useState(initialSignal ?? "");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [rep, setRep] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "score", dir: -1 });

  // Everything except the stage pill and the below-threshold toggle.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle && ![r.account, r.county, r.headline, r.signalLabel].some((f) => f.toLowerCase().includes(needle))) return false;
      if (module && r.module !== module) return false;
      if (signal === LIST ? r.signalId !== null : signal && r.signalId !== signal) return false;
      if (source && (source === "signal") !== r.signalDriven) return false;
      if (status && r.status !== status) return false;
      if (rep && r.rep !== rep) return false;
      return true;
    });
  }, [rows, q, module, signal, source, status, rep]);

  const belowCount = filtered.filter((r) => !r.lead).length;
  const inView = filtered.filter((r) => showBelow || r.lead);
  const counts = Object.fromEntries(STAGES.map((s) => [s, s === "all" ? inView.length : inView.filter((r) => r.stage === s).length]));
  const openTotal = inView.filter((r) => OPEN.includes(r.stage)).reduce((sum, r) => sum + r.amount, 0);
  const visible = inView
    .filter((r) => stage === "all" || r.stage === stage)
    .sort((a, b) => {
      const d = sort.key === "score" ? a.score - b.score : sort.key === "amount" ? a.amount - b.amount : a.created.localeCompare(b.created);
      return d * sort.dir;
    });

  const signalLabel = (id: string) => (id === LIST ? "List prospecting" : signalOptions.find((s) => s.id === id)?.label ?? id);
  const chips = [
    q.trim() && { label: `“${q.trim()}”`, clear: () => setQ("") },
    module && { label: module, clear: () => setModule("") },
    signal && { label: signalLabel(signal), clear: () => setSignal("") },
    source && { label: source === "signal" ? "Signal-driven" : "List prospecting", clear: () => setSource("") },
    status && { label: status, clear: () => setStatus("") },
    rep && { label: rep, clear: () => setRep("") },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const clearAll = () => {
    setQ("");
    setModule("");
    setSignal("");
    setSource("");
    setStatus("");
    setRep("");
  };

  const sortHeader = (key: SortKey, label: string, right = false) => (
    <th className={`px-3 py-2.5 font-semibold ${right ? "text-right" : ""}`} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: -1 }))}
        className="inline-flex items-center gap-1 hover:text-[#142e3a]"
      >
        {label}
        <span className="text-xs">{sort.key === key ? (sort.dir === -1 ? "▼" : "▲") : "↕"}</span>
      </button>
    </th>
  );

  const fromParam = signal && signal !== LIST ? `?from=${signal}` : "";

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2" aria-label="Stage">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors duration-150 ${
                stage === s ? "bg-[#3a728a] font-medium text-white" : "border border-[#bcc4cb] text-[#3f4e5b] hover:bg-white"
              }`}
            >
              {s === "all" ? "All" : STAGE_LABEL[s]} <span className="opacity-70">{counts[s]}</span>
            </button>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {belowCount > 0 && (
            <button type="button" onClick={() => setShowBelow((v) => !v)} className="text-[#3a728a] underline underline-offset-2 hover:text-[#142e3a]">
              {showBelow ? `Hide below threshold (${belowCount})` : `Show below threshold (${belowCount})`}
            </button>
          )}
          <p className="text-[#3f4e5b]">
            Open pipeline: <b className="tabular-nums">{usd(openTotal)}</b>
          </p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search account, county or signal"
          aria-label="Search account, county or signal"
          className="w-full rounded-lg border border-[#d9dee3] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#3a728a] sm:w-72"
        />
        <Select label="Module" value={module} onChange={setModule} options={MODULES.map((m) => ({ value: m, label: m }))} />
        <Select
          label="Signal"
          value={signal}
          onChange={setSignal}
          options={[...signalOptions.map((s) => ({ value: s.id, label: s.label })), { value: LIST, label: "List prospecting" }]}
        />
        <Select
          label="Source"
          value={source}
          onChange={setSource}
          options={[
            { value: "signal", label: "Signal-driven" },
            { value: "list", label: "List prospecting" },
          ]}
        />
        <Select
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "Customer", label: "Customer" },
            { value: "Prospect", label: "Prospect" },
          ]}
        />
        {manager && <Select label="Rep" value={rep} onChange={setRep} options={reps.map((r) => ({ value: r, label: r }))} />}
      </div>

      {chips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={c.clear}
              className="rounded-full bg-[#e3eef4] px-3 py-1 text-[#3a728a] transition-colors duration-150 hover:bg-[#cee5f3]"
            >
              {c.label} ×
            </button>
          ))}
          <button type="button" onClick={clearAll} className="text-[#5a6975] underline underline-offset-2">
            Clear all
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#bcc4cb] bg-white px-4 py-8 text-center text-sm text-[#5a6975]">
          {rows.length === 0
            ? "No leads yet. Open a signal from the dashboard; its accounts are scored as the page opens."
            : "Nothing matches. Change the stage or clear a filter."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#e3e7eb] bg-white shadow-[0_2px_8px_rgba(15,20,25,0.06)]">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-[#efefef] text-left text-[#3f4e5b]">
              <tr>
                {sortHeader("score", "Score")}
                <th className="px-3 py-2.5 font-semibold">Account</th>
                {manager && <th className="px-3 py-2.5 font-semibold">Rep</th>}
                <th className="px-3 py-2.5 font-semibold">Signal</th>
                <th className="px-3 py-2.5 font-semibold">Module</th>
                {sortHeader("amount", "Amount", true)}
                <th className="px-3 py-2.5 font-semibold">Stage</th>
                {sortHeader("created", "Created")}
                <th className="px-4 py-2.5" aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className={`relative border-t border-[#eef0f2] transition-colors duration-150 hover:bg-[#f6f7f8] ${r.lead ? "" : "text-[#9aa5ae]"}`}>
                  <td className="px-4 py-3 font-bold tabular-nums text-[#3a728a]">
                    {r.score}
                    {r.promoted && <span className="ml-1 text-xs font-normal text-[#1f9d55]" title="Promoted to lead">↑</span>}
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/opportunities/${r.id}${fromParam}`} className="font-semibold after:absolute after:inset-0 hover:underline">
                      {r.account}
                    </Link>
                    <p className="text-xs text-[#7a8794]">
                      {r.county} · {r.status}
                      {r.steps ? ` · ${r.steps}` : ""}
                    </p>
                  </td>
                  {manager && <td className="px-3 py-3">{r.rep}</td>}
                  <td className="px-3 py-3">{r.signalId ? r.signalLabel : <span className="text-[#7a8794]">List prospecting</span>}</td>
                  <td className="px-3 py-3">{r.module}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{usd(r.amount)}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: STAGE_COLOR[r.stage] }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: STAGE_COLOR[r.stage] }} />
                      {STAGE_LABEL[r.stage]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-[#5a6975]">{r.createdLabel}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/opportunities/${r.id}${fromParam}`}
                      className="relative z-10 inline-flex whitespace-nowrap rounded-full border border-[#3a728a] px-3 py-1 text-xs font-semibold text-[#3a728a] transition-colors duration-150 hover:bg-[#3a728a] hover:text-white"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
