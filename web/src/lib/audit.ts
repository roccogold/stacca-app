import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Actor = { id: string; displayName: string };

/**
 * Scrive una riga nel registro azioni admin (tabella AuditLog su Supabase).
 *
 * Si consulta direttamente da Supabase — non c'è UI nell'app:
 *   select "createdAt", "actorName", action, target
 *   from "AuditLog" order by "createdAt" desc;
 *
 * Convenzione `action`: "<entità>.<verbo>", es. "area.create", "user.disable".
 * `target` è il nome leggibile della cosa toccata (settore, dipendente, …).
 *
 * Non deve MAI far fallire l'operazione vera: ogni errore è solo loggato.
 */
export async function logAudit(
  actor: Actor,
  action: string,
  target?: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.displayName,
        action,
        target: target ?? null,
        meta: meta ? (meta as Prisma.InputJsonValue) : undefined,
      },
    });
  } catch (err) {
    console.error("[audit] impossibile scrivere il log:", err);
  }
}
