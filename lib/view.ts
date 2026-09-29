import { cookies } from "next/headers";

export const VIEW_COOKIE = "sd_view";
export const DANA_ID = 1;

export type View = { kind: "manager" } | { kind: "rep"; repId: number };

export function parseView(raw: string | undefined | null): View | null {
  if (raw === "manager") return { kind: "manager" };
  const id = Number(raw);
  if (Number.isInteger(id) && id >= 1 && id <= 6) return { kind: "rep", repId: id };
  return null;
}

// No cookie yet (a deep link) means Dana's view.
export async function getView(): Promise<View> {
  const store = await cookies();
  return parseView(store.get(VIEW_COOKIE)?.value) ?? { kind: "rep", repId: DANA_ID };
}
