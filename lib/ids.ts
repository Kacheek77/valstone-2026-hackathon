import { getSupabase } from "./supabase";

// Text ids in the seed's style: OPP-0042, SIG-0023. Returns the next number
// after the highest existing one. Callers retry on a primary-key clash, since
// two concurrent inserts can read the same maximum.
export async function nextIdNumber(table: "opportunities" | "signals", prefix: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from(table)
    .select("id")
    .like("id", `${prefix}-%`)
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const last = data?.[0]?.id as string | undefined;
  const n = last ? Number(last.slice(prefix.length + 1)) : 0;
  return (Number.isFinite(n) ? n : 0) + 1;
}

export function formatId(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

export const UNIQUE_VIOLATION = "23505";
