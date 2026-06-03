import type { TimeEntry } from "@prisma/client";
import { appendEntryToSheet } from "@/lib/google-sheets";
import { prisma } from "@/lib/prisma";

export async function syncEntryToGoogleSheet(
  userId: string,
  entry: TimeEntry,
): Promise<{ ok: true; skipped?: boolean } | { ok: false; error: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, email: true },
  });
  if (!user) {
    return { ok: false, error: "Utente non trovato" };
  }
  return appendEntryToSheet(user, entry);
}
