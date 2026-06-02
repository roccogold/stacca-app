import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";

async function clearSession() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.destroy();
  await session.save();
}

export async function GET(request: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function POST() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
