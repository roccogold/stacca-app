import { prisma } from "@/lib/prisma";

export type UserRole = "admin" | "dipendente";

export type ParsedUserInput =
  | { firstName: string; lastName: string; email: string; role: UserRole }
  | { error: string };

/** Derived display name kept in sync with first/last name (used by Google Sheets). */
export function buildDisplayName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
}

/**
 * The protected "owner" account: can only be edited/disabled/reset by itself,
 * never by other admins. Configurable via env, defaults to the owner email.
 */
export function getProtectedAdminEmail(): string {
  // If not set explicitly, fall back to the feedback inbox (also the owner).
  return (process.env.PROTECTED_ADMIN_EMAIL || process.env.FEEDBACK_TO_EMAIL || "")
    .trim()
    .toLowerCase();
}

export function isProtectedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === getProtectedAdminEmail();
}

/** lowercase, accent-stripped, alphanumeric-only slug for the internal handle. */
export function slugifyHandle(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
  return slug || "utente";
}

/** Generate a unique handle from a seed (email local-part or name), appending a number on collision. */
export async function generateUniqueHandle(seed: string): Promise<string> {
  const base = slugifyHandle(seed);
  let candidate = base;
  let n = 1;
  while (
    n < 1000 &&
    (await prisma.user.findUnique({ where: { handle: candidate }, select: { id: true } }))
  ) {
    n += 1;
    candidate = `${base}${n}`;
  }
  return candidate;
}

/** Validate + normalize the create/update payload coming from the admin UI. */
export function parseUserInput(body: unknown): ParsedUserInput {
  if (typeof body !== "object" || body === null) {
    return { error: "Dati non validi" };
  }
  const b = body as Record<string, unknown>;
  const firstName = typeof b.firstName === "string" ? b.firstName.trim() : "";
  const lastName = typeof b.lastName === "string" ? b.lastName.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";

  if (!firstName) return { error: "Il nome è obbligatorio" };
  if (!email || !email.includes("@") || email.length < 5) {
    return { error: "Inserisci un'email valida" };
  }
  if (b.role !== "admin" && b.role !== "dipendente") {
    return { error: "Ruolo non valido" };
  }

  return { firstName, lastName, email, role: b.role };
}
