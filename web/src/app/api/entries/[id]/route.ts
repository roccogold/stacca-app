import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { LUOGHI, MANSIONI } from "@/lib/constants";
import { assertMonthEditable, monthFromDate } from "@/lib/month-lock";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionData } from "@/lib/session";

async function getUserId(): Promise<string | null> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) return null;
  return session.userId;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.timeEntry.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Voce non trovata" }, { status: 404 });
  }

  const existingLock = await assertMonthEditable(userId, existing.date);
  if (existingLock.locked) {
    return NextResponse.json(
      { error: "Mese già inviato. Non puoi modificare questa voce." },
      { status: 403 },
    );
  }

  let body: Partial<{
    date: string;
    hours: number;
    mansione: string;
    luogo: string;
    note: string | null;
  }>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json({ error: "Data non valida" }, { status: 400 });
    }
    data.date = body.date;
  }
  if (body.hours !== undefined) {
    if (typeof body.hours !== "number" || body.hours <= 0 || body.hours > 24) {
      return NextResponse.json({ error: "Ore non valide" }, { status: 400 });
    }
    data.hours = body.hours;
  }
  if (body.mansione !== undefined) {
    if (!MANSIONI.includes(body.mansione as (typeof MANSIONI)[number])) {
      return NextResponse.json({ error: "Mansione non valida" }, { status: 400 });
    }
    data.mansione = body.mansione;
  }
  if (body.luogo !== undefined) {
    if (!LUOGHI.includes(body.luogo as (typeof LUOGHI)[number])) {
      return NextResponse.json({ error: "Luogo non valido" }, { status: 400 });
    }
    data.luogo = body.luogo;
  }
  if (body.note !== undefined) {
    data.note = body.note?.trim() || null;
  }

  const nextDate = (data.date as string | undefined) ?? existing.date;
  if (monthFromDate(nextDate) !== monthFromDate(existing.date)) {
    const nextLock = await assertMonthEditable(userId, nextDate);
    if (nextLock.locked) {
      return NextResponse.json(
        { error: "Non puoi spostare voci in un mese già inviato." },
        { status: 403 },
      );
    }
  }

  const entry = await prisma.timeEntry.update({
    where: { id },
    data,
  });

  return NextResponse.json({ entry });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.timeEntry.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Voce non trovata" }, { status: 404 });
  }

  const lock = await assertMonthEditable(userId, existing.date);
  if (lock.locked) {
    return NextResponse.json(
      { error: "Mese già inviato. Non puoi eliminare questa voce." },
      { status: 403 },
    );
  }

  await prisma.timeEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
