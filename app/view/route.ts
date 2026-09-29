import { NextResponse, type NextRequest } from "next/server";
import { parseView, VIEW_COOKIE } from "@/lib/view";

// GET /view?as=manager | /view?as=<rep id>
// Sets the sd_view cookie and lands on the right screen. Linked with plain
// <a> tags (never <Link>) so prefetching can't switch the view by accident.
export function GET(request: NextRequest) {
  const view = parseView(request.nextUrl.searchParams.get("as"));
  const target =
    view?.kind === "manager"
      ? "/team"
      : view?.kind === "rep"
        ? `/dashboard?rep=${view.repId}`
        : "/";
  const res = NextResponse.redirect(new URL(target, request.url));
  if (view) {
    res.cookies.set(VIEW_COOKIE, view.kind === "manager" ? "manager" : String(view.repId), {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
