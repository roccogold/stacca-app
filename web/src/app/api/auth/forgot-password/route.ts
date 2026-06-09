import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { hashSecret } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  rateLimitKey,
  RATE_LIMITS,
} from "@/lib/rate-limit";

const CODE_TTL_MS = 15 * 60 * 1000;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? "");

  const limit = checkRateLimit(
    rateLimitKey(req, `forgot:${email || "blank"}`),
    RATE_LIMITS.forgotPassword.limit,
    RATE_LIMITS.forgotPassword.windowMs,
  );
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Troppi tentativi. Riprova tra qualche minuto." },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Inserisci un'email valida" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Always same response — don't reveal if email exists
  const okMessage = {
    ok: true,
    message: "Se l'email è registrata, riceverai un codice a breve.",
  };

  if (!user) {
    return NextResponse.json(okMessage);
  }

  const code = String(randomInt(100000, 999999));
  const resetCodeHash = await hashSecret(code);
  const resetCodeExpiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetCodeHash, resetCodeExpiresAt },
  });

  const firstName =
    user.firstName?.trim() || user.displayName.split(" ")[0] || user.displayName;
  const safeName = firstName.replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;",
  );
  const sent = await sendEmail({
    to: email,
    subject: "Stacca — codice per reimpostare la password",
    text: [
      `Ciao ${firstName},`,
      "",
      `Ecco il codice per reimpostare la tua password: ${code}`,
      "",
      "Inseriscilo nell'app entro 15 minuti per scegliere una nuova password.",
      "",
      "Se non sei stato tu, ignora questa email.",
    ].join("\n"),
    html: [
      `<p>Ciao ${safeName},</p>`,
      `<p>Ecco il codice per reimpostare la tua password: <strong>${code}</strong></p>`,
      `<p>Inseriscilo nell'app entro 15 minuti per scegliere una nuova password.</p>`,
      `<p>Se non sei stato tu, ignora questa email.</p>`,
    ].join("\n"),
  });

  if (!sent.ok) {
    return NextResponse.json({ error: sent.error }, { status: 503 });
  }

  return NextResponse.json(okMessage);
}
