import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";

async function clearSession() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.destroy();
  await session.save();
}

// GET clears the session as a side effect, so it exists only to back
// server-side `redirect("/api/auth/logout")` calls (e.g. when a session
// points at a deleted/disabled user). NEVER point a next/link <Link> at it:
// in production Next prefetches in-viewport links, which would fire this GET
// and silently log the user out. Use a plain <a> (or the POST/logoutAction).
export async function GET(request: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
