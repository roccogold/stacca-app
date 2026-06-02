import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/session";
import { verifySecret } from "@/lib/password";
import { findUserByEmail } from "@/lib/user-auth";

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Inserisci la tua email" },
      { status: 400 },
    );
  }
  if (!password) {
    return NextResponse.json(
      { error: "Inserisci la password" },
      { status: 400 },
    );
  }

  const user = await findUserByEmail(email);
  if (!user?.passwordHash) {
    return NextResponse.json(
      { error: "Email o password non corretti" },
      { status: 401 },
    );
  }

  const ok = await verifySecret(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "Email o password non corretti" },
      { status: 401 },
    );
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.userId = user.id;
  session.handle = user.handle;
  session.displayName = user.displayName;
  session.isLoggedIn = true;
  session.mustChangePassword = user.mustChangePassword;
  await session.save();

  return NextResponse.json({
    ok: true,
    mustChangePassword: user.mustChangePassword,
    user: { displayName: user.displayName },
  });
}
