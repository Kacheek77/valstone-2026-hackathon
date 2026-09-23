import { getSupabase } from "@/lib/supabase";
import { NoteForm } from "./note-form";

// Render on every request so the entries list is always fresh. This also
// keeps `next build` from touching the database.
export const dynamic = "force-dynamic";

// Computed once when the server module loads. With the page now dynamic,
// this is the server instance's start date rather than the build date.
const buildDate = new Date().toISOString().slice(0, 10);

type Entry = { id: string; note: string; created_at: string };

async function loadEntries(): Promise<{ entries: Entry[]; error: string | null }> {
  try {
    const { data, error } = await getSupabase()
      .from("dry_run_entries")
      .select("id, note, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) return { entries: [], error: `Read failed: ${error.message}` };
    return { entries: data ?? [], error: null };
  } catch (e) {
    return {
      entries: [],
      error: `Read failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export default async function Home() {
  const { entries, error } = await loadEntries();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">Valstone 2026 Hackathon</h1>
      <p className="text-lg">Dry run — pipeline check</p>
      <p className="text-sm text-zinc-500">Built {buildDate}</p>

      <NoteForm />

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No entries yet.</p>
      ) : (
        <ul className="w-full max-w-md space-y-1 text-left text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex justify-between gap-4 border-b border-zinc-200 py-1">
              <span className="break-all">{e.note}</span>
              <span className="shrink-0 text-zinc-500">
                {new Date(e.created_at).toISOString().replace("T", " ").slice(0, 19)} UTC
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
