import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import {
  buildDisplayName,
  isProtectedEmail,
  parseUserInput,
  readAreaIds,
  setUserAreas,
} from "@/lib/admin-users";
import { logAudit } from "@/lib/audit";

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  displayName: true,
  email: true,
  role: true,
  disabled: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

function rateLimited(req: Request) {
  const rl = checkRateLimit(
    rateLimitKey(req, "admin"),
    RATE_LIMITS.admin.limit,
    RATE_LIMITS.admin.windowMs,
  );
  if (rl.ok) return null;
  return NextResponse.json(
    { error: "Troppe richieste. Riprova tra poco." },
    { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
  );
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const limited = rateLimited(req);
  if (limited) return limited;

  const { id } = await ctx.params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }
  if (isProtectedEmail(target.email) && !isProtectedEmail(auth.user.email)) {
    return NextResponse.json(
      { error: "Account protetto: modificabile solo dal titolare." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = parseUserInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { firstName, lastName, email, role } = parsed;

  const dupe = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (dupe && dupe.id !== id) {
    return NextResponse.json(
      { error: "Email già in uso da un altro utente." },
      { status: 409 },
    );
  }

  // Guardrail: never demote the last remaining admin.
  if (target.role === "admin" && role !== "admin") {
    const adminCount = await prisma.user.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "Deve restare almeno un amministratore." },
        { status: 409 },
      );
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      firstName,
      lastName,
      displayName: buildDisplayName(firstName, lastName),
      email,
      role,
    },
    select: userSelect,
  });

  // Aggiorna le aree solo se il campo è presente nel body.
  if (
    typeof body === "object" &&
    body !== null &&
    "areaIds" in (body as Record<string, unknown>)
  ) {
    await setUserAreas(id, readAreaIds(body));
  }

  await logAudit(auth.user, "user.update", user.displayName, {
    email: user.email,
    role: user.role,
  });

  return NextResponse.json({ user });
}

// Nessun endpoint di eliminazione: per GDPR / conservazione, i dati restano
// per sempre (DB + Google Sheets). L'azione più forte è "Disattiva" (blocco accesso).
