import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import {
  getActiveLavorazioneNames,
  getActiveLuogoNames,
} from "@/lib/admin-options";
import { MULTI_LUOGO_SEP } from "@/lib/constants";
import { isValidWorkHours } from "@/lib/format";
import { assertEntryDateAllowed } from "@/lib/month-lock";
import { prisma } from "@/lib/prisma";
import { refreshPresenzeTabAfterEntryChange } from "@/lib/sync-presenze-sheet";
import {
  removeEntryFromGoogleSheet,
  syncEntryToGoogleSheet,
} from "@/lib/sync-entry-sheet";
import { sessionOptions, type SessionData } from "@/lib/session";

async function getUserId(): Promise<string | null> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) return null;
  // Reject disabled accounts even if their session cookie is still valid.
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { disabled: true },
  });
  if (!user || user.disabled) return null;
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
    return NextResponse.json({ error: "Lavoro non trovato" }, { status: 404 });
  }

  const existingAllowed = await assertEntryDateAllowed(userId, existing.date);
  if (!existingAllowed.ok) {
    return NextResponse.json({ error: existingAllowed.error }, { status: 403 });
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
    if (typeof body.hours !== "number" || !isValidWorkHours(body.hours)) {
      return NextResponse.json({ error: "Ore non valide" }, { status: 400 });
    }
    data.hours = body.hours;
  }
  // Accept a value if it's currently active, OR if it's unchanged from what the
  // entry already stored — so editing an old entry whose option was since
  // archived/renamed never fails just because that value is no longer offered.
  if (body.mansione !== undefined && body.mansione !== existing.mansione) {
    const activeMansioni = await getActiveLavorazioneNames();
    if (!activeMansioni.has(body.mansione)) {
      return NextResponse.json({ error: "Lavorazione non valida" }, { status: 400 });
    }
    data.mansione = body.mansione;
  } else if (body.mansione !== undefined) {
    data.mansione = body.mansione;
  }
  if (body.luogo !== undefined && body.luogo !== existing.luogo) {
    const activeLuoghi = await getActiveLuogoNames();
    // Luogo può essere multiplo (es. Trattore): "A, B, C". Ogni parte valida.
    const parts = body.luogo ? body.luogo.split(MULTI_LUOGO_SEP) : [];
    if (parts.length === 0 || !parts.every((p) => activeLuoghi.has(p))) {
      return NextResponse.json({ error: "Luogo non valido" }, { status: 400 });
    }
    data.luogo = body.luogo;
  } else if (body.luogo !== undefined) {
    data.luogo = body.luogo;
  }
  if (body.note !== undefined) {
    data.note = body.note?.trim() || null;
  }

  const nextDate = (data.date as string | undefined) ?? existing.date;
  if (nextDate !== existing.date) {
    const nextAllowed = await assertEntryDateAllowed(userId, nextDate);
    if (!nextAllowed.ok) {
      return NextResponse.json({ error: nextAllowed.error }, { status: 403 });
    }
  }

  const entry = await prisma.timeEntry.update({
    where: { id },
    data,
  });

  revalidatePath("/");
  revalidatePath("/mese");

  after(async () => {
    const sheet = await syncEntryToGoogleSheet(userId, entry, { previous: existing });
    if (!sheet.ok) {
      console.error("[entries PATCH] Google Sheets:", sheet.error, { entryId: id });
    }
    await refreshPresenzeTabAfterEntryChange(userId);
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
    return NextResponse.json({ error: "Lavoro non trovato" }, { status: 404 });
  }

  const deleteAllowed = await assertEntryDateAllowed(userId, existing.date);
  if (!deleteAllowed.ok) {
    return NextResponse.json({ error: deleteAllowed.error }, { status: 403 });
  }

  await prisma.timeEntry.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/mese");

  after(async () => {
    const sheet = await removeEntryFromGoogleSheet(userId, existing);
    if (!sheet.ok) {
      console.error("[entries DELETE] Google Sheets:", sheet.error, { entryId: id });
    }
    await refreshPresenzeTabAfterEntryChange(userId);
  });

  return NextResponse.json({ ok: true });
}
