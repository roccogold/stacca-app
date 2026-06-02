import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { hashSecret } from "@/lib/password";

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

  const sent = await sendEmail({
    to: email,
    subject: "Stacca — codice per reimpostare la password",
    text: [
      `Ciao ${user.displayName},`,
      "",
      `Il tuo codice per reimpostare la password è: ${code}`,
      "",
      "Il codice scade tra 15 minuti.",
      "",
      "Se non l'hai richiesto tu, ignora questa email.",
    ].join("\n"),
  });

  if (!sent.ok) {
    return NextResponse.json({ error: sent.error }, { status: 503 });
  }

  return NextResponse.json(okMessage);
}
