import { cookies } from "next/headers";

export const VIEW_COOKIE = "sd_view";
export const DEMO_REP_ID = "REP-01"; // Jordan Ellsworth

export type View = { kind: "manager" } | { kind: "rep"; repId: string };

export function parseView(raw: string | undefined | null): View | null {
  if (raw === "manager") return { kind: "manager" };
  if (raw && /^REP-\d{2}$/.test(raw)) return { kind: "rep", repId: raw };
  return null;
}

// No cookie yet (a deep link) means the demo rep's view.
export async function getView(): Promise<View> {
  const store = await cookies();
  return parseView(store.get(VIEW_COOKIE)?.value) ?? { kind: "rep", repId: DEMO_REP_ID };
}
