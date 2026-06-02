import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashSecret, validatePassword, verifySecret } from "@/lib/password";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(req: Request) {
  let body: {
    email?: string;
    code?: string;
    password?: string;
    confirm?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const email = normalizeEmail(body.email ?? "");
  const code = body.code?.trim() ?? "";
  const password = body.password ?? "";
  const confirm = body.confirm ?? "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email non valida" }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Codice non valido" }, { status: 400 });
  }

  const pwdErr = validatePassword(password);
  if (pwdErr) return NextResponse.json({ error: pwdErr }, { status: 400 });
  if (password !== confirm) {
    return NextResponse.json(
      { error: "Le password non coincidono" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (
    !user?.resetCodeHash ||
    !user.resetCodeExpiresAt ||
    user.resetCodeExpiresAt < new Date()
  ) {
    return NextResponse.json(
      { error: "Codice scaduto o non valido. Richiedine uno nuovo." },
      { status: 401 },
    );
  }

  const codeOk = await verifySecret(code, user.resetCodeHash);
  if (!codeOk) {
    return NextResponse.json({ error: "Codice non valido" }, { status: 401 });
  }

  const passwordHash = await hashSecret(password);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
      resetCodeHash: null,
      resetCodeExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
