import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { generateTemporaryPassword, hashSecret } from "@/lib/password";

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
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashSecret(temporaryPassword);

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      mustChangePassword: true,
      resetCodeHash: null,
      resetCodeExpiresAt: null,
    },
  });

  // temporaryPassword is returned once — never stored or shown again.
  return NextResponse.json({ temporaryPassword });
}
