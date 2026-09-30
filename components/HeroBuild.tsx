"use client";

import { useEffect, useRef, useState } from "react";
import { FA } from "./faIcons";

// VS-13 W3: the headline, animated. About 6 s, once, then holds the last frame
// (hover to replay). 1 Random: gray accounts, outreach fired at random. 2 A
// county's drought worsens. 3 Targeted: the 9 matched accounts turn teal and
// get score rings; the rest fade. 4 Conversion: they converge into a pipeline
// pill. CSS animations only; under prefers-reduced-motion the last frame shows
// as is (every element's resting style is its final state).

const W = 480;
const H = 300;
const COLS = 8;
const ROWS = 5;
const CW = 54;
const CH = 44;
const X0 = 24;
const Y0 = 34;
const TARGET = { c: 3, r: 2 };
const TX = X0 + TARGET.c * CW;
const TY = Y0 + TARGET.r * CH;
const SCORES = [93, 88, 86, 84, 81, 77, 72, 68, 61];
const PILL = { x: 300, y: 256, w: 164, h: 30 };

// Deterministic layout (same on server and client).
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}
const rand = rng(7);
const matched = SCORES.map((_, i) => {
  const a = (i / SCORES.length) * Math.PI * 2 + 0.4;
  const d = i === 0 ? 6 : 16 + (i % 3) * 10;
  return { x: TX + CW / 2 + Math.cos(a) * d * 1.5, y: TY + CH / 2 + Math.sin(a) * d };
});
const others: { x: number; y: number }[] = [];
while (others.length < 31) {
  const x = X0 + 8 + rand() * (COLS * CW - 16);
  const y = Y0 + 8 + rand() * (ROWS * CH - 16);
  const nearCluster = Math.abs(x - (TX + CW / 2)) < 70 && Math.abs(y - (TY + CH / 2)) < 52;
  const nearPill = x > PILL.x - 10 && y > PILL.y - 16;
  if (!nearCluster && !nearPill) others.push({ x, y });
}
const ARROWS = [2, 9, 15, 21, 27].map((i, k) => ({ to: others[i], delay: 0.25 + k * 0.22 }));
const RING_R = 8;
const RING_C = 2 * Math.PI * RING_R;
const icon = FA["sun-plant-wilt"];

export function HeroBuild() {
  const [run, setRun] = useState(0);
  const [amount, setAmount] = useState(103);
  const started = useRef(0);

  // Count the pipeline value up as the pill appears (4.6 s in).
  useEffect(() => {
    started.current = performance.now();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const tick = (now: number) => {
      const t = (now - started.current - 4600) / 800;
      setAmount(Math.round(103 * Math.max(0, Math.min(1, t))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run]);

  const replay = () => {
    if (performance.now() - started.current > 6300) setRun((n) => n + 1);
  };

  return (
    <svg
      key={run}
      viewBox={`0 0 ${W} ${H}`}
      className="hb h-auto w-full"
      role="img"
      aria-label="From random outreach to targeted selling and conversion: a drought hits one county, nine matched accounts are scored, and they become nine leads worth $103k expected."
      onMouseEnter={replay}
    >
      <defs>
        <filter id="hb-blur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <marker id="hb-head" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L6 3 L0 6 Z" fill="#9aa5ae" />
        </marker>
      </defs>

      {/* Frame captions */}
      <g fontSize="12" fontWeight="700" fill="#3f4e5b">
        <text className="hb-cap hb-cap1" x={X0} y="20">1 · Random outreach</text>
        <text className="hb-cap hb-cap2" x={X0} y="20">2 · The weather changes one county</text>
        <text className="hb-cap hb-cap3" x={X0} y="20">3 · Targeted: 9 accounts matched and scored</text>
        <text className="hb-cap hb-cap4" x={X0} y="20">4 · Conversion</text>
      </g>

      {/* Faint county grid (Plains counties are near-rectangles) */}
      <g fill="none" stroke="#d9dee3" strokeWidth="1">
        {Array.from({ length: COLS * ROWS }, (_, i) => {
          const c = i % COLS;
          const r = Math.floor(i / COLS);
          return <rect key={i} x={X0 + c * CW} y={Y0 + r * CH} width={CW} height={CH} />;
        })}
      </g>

      {/* Frame 2: the drought county, with the map's glow and icon */}
      <rect className="hb-glow" x={TX} y={TY} width={CW} height={CH} fill="none" stroke="#d23b3b" strokeWidth="8" filter="url(#hb-blur)" />
      <rect className="hb-county" x={TX} y={TY} width={CW} height={CH} strokeWidth="2.5" />

      {/* Frame 1: outreach fired at random accounts */}
      {ARROWS.map((a, i) => {
        const len = Math.hypot(a.to.x - 6, a.to.y - 150);
        return (
          <line
            key={i}
            className="hb-arrow"
            x1="6"
            y1="150"
            x2={a.to.x - 4}
            y2={a.to.y}
            stroke="#9aa5ae"
            strokeWidth="1.2"
            markerEnd="url(#hb-head)"
            strokeDasharray={len}
            style={{ "--len": len, "--d": `${a.delay}s` } as React.CSSProperties}
          />
        );
      })}

      {/* Accounts */}
      {others.map((p, i) => (
        <circle key={i} className="hb-dot" cx={p.x} cy={p.y} r="3.6" />
      ))}

      {/* Frame 4: the matched accounts converge into the pipeline */}
      {matched.map((p, i) => {
        const tx = PILL.x + 18;
        const ty = PILL.y + PILL.h / 2;
        const len = Math.hypot(tx - p.x, ty - p.y);
        return (
          <line
            key={i}
            className="hb-line"
            x1={p.x}
            y1={p.y}
            x2={tx}
            y2={ty}
            stroke="#3a728a"
            strokeWidth="1.1"
            strokeDasharray={len}
            style={{ "--len": len, "--d": `${4 + i * 0.05}s` } as React.CSSProperties}
          />
        );
      })}

      {/* Frame 3: matched accounts turn teal, score rings sweep up */}
      {matched.map((p, i) => (
        <g key={i}>
          <circle className="hb-hit" cx={p.x} cy={p.y} r="3.8" style={{ "--d": `${2.6 + i * 0.07}s` } as React.CSSProperties} />
          <circle cx={p.x} cy={p.y} r={RING_R} fill="none" stroke="#e3e7eb" strokeWidth="2.2" className="hb-ringbg" style={{ "--d": `${2.7 + i * 0.07}s` } as React.CSSProperties} />
          <circle
            className="hb-ring"
            cx={p.x}
            cy={p.y}
            r={RING_R}
            fill="none"
            stroke={SCORES[i] >= 75 ? "#1f9d55" : "#3a728a"}
            strokeWidth="2.2"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - SCORES[i] / 100)}
            transform={`rotate(-90 ${p.x} ${p.y})`}
            style={{ "--c": RING_C, "--d": `${2.8 + i * 0.08}s` } as React.CSSProperties}
          />
        </g>
      ))}

      {/* The app's drought icon drops into the county */}
      <g className="hb-icon">
        <circle cx={TX + CW / 2} cy={TY - 2} r="13" fill="#d23b3b" stroke="#fff" strokeWidth="2" />
        {icon && (
          <svg x={TX + CW / 2 - 8} y={TY - 10} width="16" height="16" viewBox={icon.viewBox}>
            <path d={icon.d} fill="#fff" />
          </svg>
        )}
      </g>

      {/* The pipeline pill */}
      <g className="hb-pill">
        <rect x={PILL.x} y={PILL.y} width={PILL.w} height={PILL.h} rx="15" fill="#1f9d55" />
        <text x={PILL.x + PILL.w / 2} y={PILL.y + 19.5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">
          9 leads · ${amount}k expected
        </text>
      </g>
    </svg>
  );
}
