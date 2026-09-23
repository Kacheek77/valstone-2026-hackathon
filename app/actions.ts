"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";

export type AddNoteState = { error: string | null };

const MAX_NOTE_LENGTH = 500;

export async function addNote(
  _prev: AddNoteState,
  formData: FormData,
): Promise<AddNoteState> {
  const note = String(formData.get("note") ?? "").trim();
  if (!note) return { error: "Note is empty." };
  if (note.length > MAX_NOTE_LENGTH) {
    return { error: `Note is longer than ${MAX_NOTE_LENGTH} characters.` };
  }

  try {
    const { error } = await getSupabase()
      .from("dry_run_entries")
      .insert({ note });
    if (error) return { error: `Insert failed: ${error.message}` };
  } catch (e) {
    return { error: `Insert failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  revalidatePath("/");
  return { error: null };
}
