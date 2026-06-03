import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import {
  appendRowsToSheet,
  buildSheetRows,
  ensureSheetHeader,
} from "@/lib/google-sheets";
import { isValidMonthKey, isMonthLocked } from "@/lib/month-lock";
import { prisma } from "@/lib/prisma";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function POST(req: Request) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.isLoggedIn || !session.userId) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  let body: { month?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const month = body.month?.trim() ?? "";
  if (!isValidMonthKey(month)) {
    return NextResponse.json({ error: "Mese non valido" }, { status: 400 });
  }

  const [y, m] = month.split("-").map(Number);
  const now = new Date();
  const canSubmit =
    y < now.getFullYear() ||
    (y === now.getFullYear() && m <= now.getMonth() + 1);

  if (!canSubmit) {
    return NextResponse.json(
      { error: "Puoi inviare solo mesi conclusi o il mese corrente." },
      { status: 400 },
    );
  }

  if (await isMonthLocked(session.userId, month)) {
    return NextResponse.json(
      { error: "Questo mese è già stato inviato." },
      { status: 409 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }

  const entries = await prisma.timeEntry.findMany({
    where: { userId: user.id, date: { startsWith: month } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  if (entries.length === 0) {
    return NextResponse.json(
      { error: "Nessun lavoro da inviare per questo mese." },
      { status: 400 },
    );
  }

  const totalHours = entries.reduce((a, e) => a + e.hours, 0);
  const submittedAt = new Date();

  await ensureSheetHeader();
  const rows = buildSheetRows(user, entries, month, submittedAt);
  const sent = await appendRowsToSheet(rows);

  if (!sent.ok) {
    return NextResponse.json({ error: sent.error }, { status: 503 });
  }

  await prisma.monthSubmission.create({
    data: {
      userId: user.id,
      month,
      totalHours,
      submittedAt,
    },
  });

  return NextResponse.json({
    ok: true,
    month,
    totalHours,
    submittedAt: submittedAt.toISOString(),
  });
}
