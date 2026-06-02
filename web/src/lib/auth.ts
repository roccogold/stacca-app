import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";

export type AppUser = {
  id: string;
  displayName: string;
};

/** Auth from session cookie only — no DB round-trip per navigation. */
export async function requireUser(): Promise<AppUser> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    redirect("/login");
  }
  if (session.mustChangePassword) {
    redirect("/login/nuova-password");
  }
  return {
    id: session.userId,
    displayName: session.displayName ?? "Utente",
  };
}

export async function requireLoggedInSession() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    redirect("/login");
  }
  return session;
}

export async function requireDbUser() {
  const session = await requireLoggedInSession();
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    redirect("/api/auth/logout");
  }
  return user;
}

export async function optionalUser() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) return null;
  return {
    id: session.userId,
    displayName: session.displayName ?? "Utente",
  } satisfies AppUser;
}
