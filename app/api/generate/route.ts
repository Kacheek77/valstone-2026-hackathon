import { NextResponse, type NextRequest } from "next/server";
import { generateOne } from "@/lib/generate";

// POST { signalId, accountId } -> GenerateResult.
// A route handler rather than a server action: Next.js runs server actions
// from one page one at a time, so the Generate button's three-at-a-time
// scoring only runs in parallel through plain fetch calls.
export const maxDuration = 30;

const SIGNAL_ID = /^SIG-\d{4}$/;
const ACCOUNT_ID = /^ACC-\d{3,4}$/;

export async function POST(request: NextRequest) {
  let body: { signalId?: unknown; accountId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const { signalId, accountId } = body;
  if (typeof signalId !== "string" || !SIGNAL_ID.test(signalId) || typeof accountId !== "string" || !ACCOUNT_ID.test(accountId)) {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  return NextResponse.json(await generateOne(signalId, accountId));
}
