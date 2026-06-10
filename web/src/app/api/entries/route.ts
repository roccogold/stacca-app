import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { LUOGHI, MANSIONI } from "@/lib/constants";
import { isValidWorkHours } from "@/lib/format";
import { assertEntryDateAllowed } from "@/lib/month-lock";
import { prisma } from "@/lib/prisma";
import { refreshPresenzeTabAfterEntryChange } from "@/lib/sync-presenze-sheet";
import { syncEntryToGoogleSheet } from "@/lib/sync-entry-sheet";
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

export async function GET(req: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const date = searchParams.get("date");

  if (date) {
    const entries = await prisma.timeEntry.findMany({
      where: { userId, date },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ entries });
  }

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const entries = await prisma.timeEntry.findMany({
      where: { userId, date: { startsWith: month } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ entries });
  }

  return NextResponse.json(
    { error: "Usa ?date=YYYY-MM-DD o ?month=YYYY-MM" },
    { status: 400 },
  );
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  let body: {
    date?: string;
    hours?: number;
    mansione?: string;
    luogo?: string;
    note?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const { date, hours, mansione, luogo, note } = body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Data non valida" }, { status: 400 });
  }
  if (typeof hours !== "number" || !isValidWorkHours(hours)) {
    return NextResponse.json({ error: "Ore non valide" }, { status: 400 });
  }
  if (!mansione || !MANSIONI.includes(mansione as (typeof MANSIONI)[number])) {
    return NextResponse.json({ error: "Lavorazione non valida" }, { status: 400 });
  }
  if (!luogo || !LUOGHI.includes(luogo as (typeof LUOGHI)[number])) {
    return NextResponse.json({ error: "Luogo non valido" }, { status: 400 });
  }

  const allowed = await assertEntryDateAllowed(userId, date);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: 403 });
  }

  const entry = await prisma.timeEntry.create({
    data: {
      userId,
      date,
      hours,
      mansione,
      luogo,
      note: note?.trim() || null,
    },
  });

  revalidatePath("/");
  revalidatePath("/mese");

  after(async () => {
    const sheet = await syncEntryToGoogleSheet(userId, entry);
    if (!sheet.ok) {
      console.error("[entries POST] Google Sheets:", sheet.error, { entryId: entry.id });
    }
    await refreshPresenzeTabAfterEntryChange(userId);
  });

  return NextResponse.json({ entry });
}
