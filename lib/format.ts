import type { Signal } from "./types";

export function usd(n: number): string {
  if (n >= 1000) return `$${Math.round(n / 1000).toLocaleString("en-US")}k`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function usdExact(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function pct(n: number | null): string {
  return n === null ? "—" : `${Math.round(n)}%`;
}

export function weekLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Capture-rate colour bands: green 70%+, amber 50–69%, red under 50%.
export function captureColor(p: number | null): string {
  if (p === null) return "text-[#7a8794]";
  if (p >= 70) return "text-[#1f9d55]";
  if (p >= 50) return "text-[#e89b16]";
  return "text-[#d23b3b]";
}

// "Finney, KS · D2 → D3" or "Deaf Smith, TX · 4 days over 98 °F".
export function eventLine(s: Signal): string {
  const place = `${s.county}, ${s.state}`;
  const drought = s.headline.match(/from (D\d|no drought) to (D\d)/);
  if (drought) return `${place} · ${drought[1]} → ${drought[2]}`;
  const after = s.headline.split(": ")[1];
  return after ? `${place} · ${after}` : place;
}
