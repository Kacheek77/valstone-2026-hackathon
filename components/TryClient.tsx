"use client";

import { useRef, useState } from "react";
import { useHydrated } from "@/lib/useHydrated";
import { TRY_CHIPS, TRY_MAX_INPUT, TRY_VERTICALS, type TryOutput } from "@/lib/tryChips";
import { ScoreRing } from "./ScoreRing";

type Result = { key: string; label: string; output: TryOutput; live: boolean };

const card = "rounded-xl border border-[#e3e7eb] bg-white shadow-[0_2px_8px_rgba(15,20,25,0.06)]";

function Shimmer() {
  return (
    <div className="flex flex-col gap-3" aria-label="Claude is writing" role="status">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${card} flex flex-col gap-2 px-4 py-3`}>
            <span className="sd-shimmer block h-2.5 w-20" />
            <span className="sd-shimmer block h-3 w-full" />
            <span className="sd-shimmer block h-3 w-3/4" />
          </div>
        ))}
      </div>
      <div className={`${card} flex gap-4 px-4 py-4`}>
        <span className="sd-shimmer block h-10 w-10 shrink-0 rounded-full" />
        <span className="flex flex-1 flex-col gap-2">
          <span className="sd-shimmer block h-3 w-1/2" />
          <span className="sd-shimmer block h-3 w-full" />
          <span className="sd-shimmer block h-3 w-5/6" />
        </span>
      </div>
      <p className="text-sm text-[#5a6975]">Claude is applying Signal Desk to this business… (about 10 seconds)</p>
    </div>
  );
}

// The answer, drawn with the app's own pieces: signal cards, the score ring,
// the why-now line and the email card. Sections fade in one after another.
function Answer({ r }: { r: Result }) {
  const { output: o } = r;
  const step = (i: number) => ({ className: "sd-fade-in", style: { animationDelay: `${i * 140}ms`, animationFillMode: "both" as const } });
  return (
    <div className="flex flex-col gap-4">
      <p {...step(0)} className="sd-fade-in text-[15px] text-[#3f4e5b]" style={step(0).style}>
        <span className="mr-2 rounded bg-[#fcf1d9] px-1.5 py-0.5 text-xs font-semibold text-[#8a5a00]">Illustrative example</span>
        {o.business}
      </p>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#7a8794]">Three signals Signal Desk would watch</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {o.signals.map((s, i) => (
            <div key={i} className={`${card} sd-fade-in border-l-[5px] px-4 py-3`} style={{ borderLeftColor: "#3a728a", ...step(i + 1).style }}>
              <p className="font-semibold leading-snug text-[#142e3a]">{s.event}</p>
              <p className="mt-1 text-sm text-[#5a6975]">
                {s.source} · {s.cadence}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className={`${card} sd-fade-in overflow-hidden`} style={step(4).style}>
        <div className="flex flex-wrap items-start gap-4 border-b border-[#eef0f2] px-4 py-4">
          <ScoreRing score={o.example.score} threshold={50} sweep />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#7a8794]">Worked lead · fictional account</p>
            <p className="text-lg font-bold text-[#142e3a]">{o.example.account.name}</p>
            <p className="text-sm text-[#5a6975]">
              {o.example.account.location} · {o.example.account.profile}
            </p>
          </div>
        </div>
        <div className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-[120px_1fr]">
          <span className="text-[#7a8794]">Signal</span>
          <span>{o.example.signal}</span>
          <span className="text-[#7a8794]">Why now</span>
          <span className="leading-relaxed">{o.example.why_now}</span>
          <span className="text-[#7a8794]">Lead with</span>
          <span className="font-semibold">{o.example.lead_with}</span>
        </div>
      </div>

      <div className={`${card} sd-fade-in px-4 py-4`} style={step(5).style}>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#7a8794]">Draft email</p>
        <p className="mt-1 font-semibold">{o.example.email_subject}</p>
        <p className="mt-2 whitespace-pre-line leading-relaxed text-[#3f4e5b]">{o.example.email_body}</p>
      </div>

      <p className="sd-fade-in rounded-lg bg-[#eef5f9] px-4 py-3 text-sm text-[#2c5a6e]" style={step(6).style}>
        {o.needs}
      </p>
    </div>
  );
}

export function TryClient({ fixtures }: { fixtures: Record<string, TryOutput> }) {
  const hydrated = useHydrated();
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const out = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const nextKey = (base: string) => `${base}-${++seq.current}`;
  const reveal = () => requestAnimationFrame(() => out.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

  const live = async (key: string, label: string, body: { chip?: string; text?: string }) => {
    setBusy(key);
    setError(null);
    setResult(null);
    reveal();
    try {
      const res = await fetch("/api/try", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await res.json()) as { ok: boolean; output?: TryOutput; error?: string };
      if (j.ok && j.output) setResult({ key, label, output: j.output, live: true });
      else {
        setError(j.error ?? "Claude did not answer in time. Try one of the companies above.");
        if (body.chip && fixtures[body.chip]) setResult({ key, label, output: fixtures[body.chip], live: false });
      }
    } catch {
      setError("The server did not answer. Try one of the companies above.");
    }
    setBusy(null);
  };

  const pick = (id: string) => {
    const chip = TRY_CHIPS.find((c) => c.id === id)!;
    setError(null);
    if (fixtures[id]) {
      setResult({ key: nextKey(id), label: chip.name, output: fixtures[id], live: false });
      reveal();
    } else void live(id, chip.name, { chip: id });
  };

  const current = result ? TRY_CHIPS.find((c) => result.key.startsWith(c.id)) : undefined;

  return (
    <>
      <div className="flex flex-col gap-4">
        {TRY_VERTICALS.map((v) => (
          <div key={v}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#7a8794]">{v}</p>
            <div className="flex flex-wrap gap-2">
              {TRY_CHIPS.filter((c) => c.vertical === v).map((c) => {
                const on = current?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!hydrated || busy !== null}
                    onClick={() => pick(c.id)}
                    title={c.sells}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 disabled:opacity-60 ${
                      on ? "border-[#3a728a] bg-[#3a728a] text-white" : "border-[#bcc4cb] bg-white text-[#142e3a] hover:border-[#3a728a] hover:text-[#3a728a]"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <form
        className="mt-5 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) void live(nextKey("text"), "Your business", { text: text.trim() });
        }}
      >
        <label htmlFor="try-text" className="text-sm font-semibold text-[#142e3a]">
          Or describe your business: what you sell, to whom, and what event makes them buy.
        </label>
        <textarea
          id="try-text"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, TRY_MAX_INPUT))}
          maxLength={TRY_MAX_INPUT}
          rows={3}
          placeholder="We sell HVAC service contracts to office buildings; heat waves drive calls."
          className="rounded-lg border border-[#d9dee3] bg-white px-3 py-2 text-[15px] outline-none focus:border-[#3a728a]"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#9aa5ae]">
            {text.length}/{TRY_MAX_INPUT} · nothing is stored
          </span>
          <button
            type="submit"
            disabled={!hydrated || busy !== null || !text.trim()}
            className="rounded-full bg-[#3a728a] px-5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#142e3a] disabled:opacity-50"
          >
            {busy?.startsWith("text") ? "Working…" : "Show me"}
          </button>
        </div>
      </form>

      <div ref={out} className="mt-6 scroll-mt-4">
        {busy && <Shimmer />}
        {error && <p className="mb-3 rounded-lg bg-[#fdecec] px-4 py-2 text-sm text-[#8f2424]">{error}</p>}
        {result && !busy && (
          <>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-bold text-[#142e3a]">Signal Desk for {result.label}</h2>
              {current && (
                <button
                  type="button"
                  onClick={() => void live(nextKey(`${current.id}-live`), current.name, { chip: current.id })}
                  className="text-sm text-[#3a728a] underline underline-offset-2"
                >
                  {result.live ? "Regenerate again" : "Regenerate live"}
                </button>
              )}
            </div>
            <Answer key={result.key} r={result} />
          </>
        )}
      </div>
    </>
  );
}
