import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { isProtectedEmail } from "@/lib/admin-users";
import { logAudit } from "@/lib/audit";

/**
 * Archive (hide from the admin list) / un-archive a user. NO data is deleted:
 * the user record, TimeEntry, MonthSubmission and Google Sheets rows all stay.
 * Archiving is allowed only for already-disabled accounts.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const rl = checkRateLimit(
    rateLimitKey(req, "admin"),
    RATE_LIMITS.admin.limit,
    RATE_LIMITS.admin.windowMs,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Troppe richieste. Riprova tra poco." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }
  const archived =
    typeof body === "object" && body !== null
      ? (body as { archived?: unknown }).archived
      : undefined;
  if (typeof archived !== "boolean") {
    return NextResponse.json({ error: "Campo 'archived' mancante" }, { status: 400 });
  }

  if (archived && id === auth.user.id) {
    return NextResponse.json(
      { error: "Non puoi archiviare il tuo account." },
      { status: 409 },
    );
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, disabled: true, displayName: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }
  if (isProtectedEmail(target.email) && !isProtectedEmail(auth.user.email)) {
    return NextResponse.json(
      { error: "Account protetto: gestibile solo dal titolare." },
      { status: 403 },
    );
  }
  if (archived && !target.disabled) {
    return NextResponse.json(
      { error: "Disattiva l'account prima di archiviarlo." },
      { status: 409 },
    );
  }

  await prisma.user.update({ where: { id }, data: { archived } });
  await logAudit(
    auth.user,
    archived ? "user.archive" : "user.unarchive",
    target.displayName,
  );
  return NextResponse.json({ ok: true });
}
