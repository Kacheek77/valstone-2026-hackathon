// "40 h" under two days, "4.6 d" from two days up; "—" when there is nothing to measure.
export function hoursLabel(h: number | null): string {
  if (h === null) return "—";
  return h >= 48 ? `${(h / 24).toFixed(1)} d` : `${Math.round(h)} h`;
}
