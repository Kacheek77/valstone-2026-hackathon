import { NextResponse, type NextRequest } from "next/server";
import { generateTry } from "@/lib/try";
import { TRY_CHIPS, TRY_MAX_INPUT } from "@/lib/tryChips";

// POST { chip } or { text } -> { ok, output } (VS-13 TRY). Nothing is stored.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  let body: { chip?: unknown; text?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const chip = typeof body.chip === "string" ? TRY_CHIPS.find((c) => c.id === body.chip) : undefined;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!chip && !text) return NextResponse.json({ ok: false, error: "Pick a company or describe a business." }, { status: 400 });
  if (text.length > TRY_MAX_INPUT) return NextResponse.json({ ok: false, error: `Keep it under ${TRY_MAX_INPUT} characters.` }, { status: 400 });
  const output = await generateTry(chip ? { chip } : { text });
  if (!output) return NextResponse.json({ ok: false, error: "Claude did not answer in time. Try one of the companies above." });
  return NextResponse.json({ ok: true, output });
}
