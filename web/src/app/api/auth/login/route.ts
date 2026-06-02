import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionData } from "@/lib/session";

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: Request) {
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const displayName = body.name?.trim();
  if (!displayName || displayName.length < 2) {
    return NextResponse.json(
      { error: "Nome troppo corto (min 2 caratteri)" },
      { status: 400 },
    );
  }
  const handle = slugify(displayName);
  if (handle.length < 2) {
    return NextResponse.json({ error: "Nome non valido" }, { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { handle },
    create: { handle, displayName },
    update: { displayName },
  });

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.userId = user.id;
  session.handle = user.handle;
  session.displayName = user.displayName;
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({
    ok: true,
    user: { displayName: user.displayName },
  });
}
