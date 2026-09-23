"use client";

import { useActionState } from "react";
import { addNote, type AddNoteState } from "./actions";

const initialState: AddNoteState = { error: null };

export function NoteForm() {
  const [state, formAction, pending] = useActionState(addNote, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="note"
          type="text"
          required
          maxLength={500}
          placeholder="note"
          aria-label="note"
          className="flex-1 rounded border border-zinc-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Submit"}
        </button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
