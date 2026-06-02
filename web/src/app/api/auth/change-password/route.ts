import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  hashSecret,
  validatePassword,
  verifySecret,
} from "@/lib/password";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function POST(req: Request) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  let body: { password?: string; confirm?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const password = body.password ?? "";
  const confirm = body.confirm ?? "";

  const pwdErr = validatePassword(password);
  if (pwdErr) return NextResponse.json({ error: pwdErr }, { status: 400 });
  if (password !== confirm) {
    return NextResponse.json(
      { error: "Le password non coincidono" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }

  const passwordHash = await hashSecret(password);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
    },
  });

  session.mustChangePassword = false;
  await session.save();

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  let body: {
    currentPassword?: string;
    password?: string;
    confirm?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }

  const currentOk = await verifySecret(body.currentPassword ?? "", user.passwordHash);
  if (!currentOk) {
    return NextResponse.json(
      { error: "Password attuale non corretta" },
      { status: 401 },
    );
  }

  const password = body.password ?? "";
  const pwdErr = validatePassword(password);
  if (pwdErr) return NextResponse.json({ error: pwdErr }, { status: 400 });
  if (password !== (body.confirm ?? "")) {
    return NextResponse.json(
      { error: "Le password non coincidono" },
      { status: 400 },
    );
  }

  const passwordHash = await hashSecret(password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  session.mustChangePassword = false;
  await session.save();

  return NextResponse.json({ ok: true });
}
