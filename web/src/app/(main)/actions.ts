"use server";

import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function logoutAction() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.destroy();
  await session.save();
  redirect("/login");
}
