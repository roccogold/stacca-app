import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";

export type AppUser = {
  id: string;
  displayName: string;
  role: "admin" | "dipendente";
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
    role: session.role ?? "dipendente",
  };
}

/**
 * Session-guarded current user, but with the role read fresh from the DB.
 * Use where role must be current (nav, admin gate) so a just-promoted/demoted
 * user doesn't have to log out and back in.
 */
export async function requireUserWithRole(): Promise<AppUser> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    redirect("/login");
  }
  if (session.mustChangePassword) {
    redirect("/login/nuova-password");
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, disabled: true },
  });
  if (!dbUser || dbUser.disabled) {
    redirect("/api/auth/logout");
  }
  return {
    id: session.userId,
    displayName: session.displayName ?? "Utente",
    role: dbUser.role,
  };
}

/** Page guard for admin-only routes. Redirects non-admins to home. DB-backed. */
export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUserWithRole();
  if (user.role !== "admin") {
    redirect("/");
  }
  return user;
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

/**
 * API guard for admin-only route handlers. Verifies the role against the DB
 * (not just the session cookie) so a demoted admin can't keep managing users.
 * Returns the fresh admin user on success, or a ready-to-return error response.
 */
export async function requireAdminApi() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Non autenticato" }, { status: 401 }),
    };
  }
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Non autenticato" }, { status: 401 }),
    };
  }
  if (user.role !== "admin" || user.disabled) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Accesso riservato agli amministratori" },
        { status: 403 },
      ),
    };
  }
  return { ok: true as const, user };
}

export async function optionalUser() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) return null;
  return {
    id: session.userId,
    displayName: session.displayName ?? "Utente",
    role: session.role ?? "dipendente",
  } satisfies AppUser;
}
