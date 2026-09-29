"use client";

import { useEffect, useState } from "react";

type Format = "usd" | "pct" | "hours" | "int";

function render(n: number, format: Format): string {
  switch (format) {
    case "usd":
      return n >= 1000 ? `$${Math.round(n / 1000).toLocaleString("en-US")}k` : `$${Math.round(n)}`;
    case "pct":
      return `${Math.round(n)}%`;
    case "hours":
      return n.toFixed(1);
    default:
      return String(Math.round(n));
  }
}

// Server renders the final value (so it is right without JavaScript); after
// hydration it counts up from zero once.
export function CountUp({ value, format, className }: { value: number; format: Format; className?: string }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className={className}>{render(shown, format)}</span>;
}
