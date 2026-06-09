import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

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

/**
 * Enable/disable a user's login WITHOUT deleting any data.
 * Body: { disabled: boolean }. Their TimeEntry / MonthSubmission rows are kept.
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
  const disabled =
    typeof body === "object" && body !== null
      ? (body as { disabled?: unknown }).disabled
      : undefined;
  if (typeof disabled !== "boolean") {
    return NextResponse.json({ error: "Campo 'disabled' mancante" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, disabled: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }

  if (disabled) {
    if (id === auth.user.id) {
      return NextResponse.json(
        { error: "Non puoi disattivare il tuo account." },
        { status: 409 },
      );
    }
    // Guardrail: keep at least one active admin.
    if (target.role === "admin") {
      const activeAdmins = await prisma.user.count({
        where: { role: "admin", disabled: false },
      });
      if (activeAdmins <= 1) {
        return NextResponse.json(
          { error: "Deve restare almeno un amministratore attivo." },
          { status: 409 },
        );
      }
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: { disabled },
    select: userSelect,
  });
  return NextResponse.json({ user });
}
