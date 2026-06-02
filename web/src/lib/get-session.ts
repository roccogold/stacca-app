import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(
    cookieStore,
    sessionOptions,
  );
  if (session.isLoggedIn === undefined) session.isLoggedIn = false;
  return session;
}
