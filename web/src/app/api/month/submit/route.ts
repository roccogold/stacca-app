import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { appendMonthClosureToSheet } from "@/lib/google-sheets";
import { syncEmployeePresenzeTab } from "@/lib/sync-presenze-sheet";
import { canSubmitMonthRome, isValidMonthKey, isMonthLocked } from "@/lib/month-lock";
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
  if (!canSubmitMonthRome(y, m)) {
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

  await prisma.monthSubmission.create({
    data: {
      userId: user.id,
      month,
      totalHours,
      submittedAt,
    },
  });

  revalidatePath("/");
  revalidatePath("/mese");

  after(async () => {
    const [sent, presenze] = await Promise.all([
      appendMonthClosureToSheet(user, month, totalHours, submittedAt),
      syncEmployeePresenzeTab(user.id),
    ]);
    if (!sent.ok) {
      console.error("[month/submit] Ore Totali:", sent.error, { userId: user.id, month });
    }
    if (!presenze.ok) {
      console.error("[month/submit] Presenze:", presenze.error, { userId: user.id, month });
    }
  });

  return NextResponse.json({
    ok: true,
    month,
    totalHours,
    submittedAt: submittedAt.toISOString(),
  });
}
