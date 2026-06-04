import Link from "next/link";
import { MesePageClient } from "@/components/MesePageClient";
import { canSubmitMonthRome, getMonthSubmission } from "@/lib/month-lock";
import { requireUser } from "@/lib/auth";
import { monthTitle, romeCalendarParts } from "@/lib/format";
import { prisma } from "@/lib/prisma";

function monthKey(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

export default async function MesePage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string; d?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const rome = romeCalendarParts();
  const y = sp.y ? Number(sp.y) : rome.y;
  const m = sp.m ? Number(sp.m) : rome.m;
  const selectedDay =
    sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : null;

  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return (
      <main className="screen">
        <p>Mese non valido.</p>
        <Link href="/mese">Torna al mese corrente</Link>
      </main>
    );
  }

  const prefix = monthKey(y, m);
  const [entries, submission] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { userId: user.id, date: { startsWith: prefix } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    getMonthSubmission(user.id, prefix),
  ]);

  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  const prevHref = `/mese?y=${prev.y}&m=${prev.m}`;
  const nextHref = `/mese?y=${next.y}&m=${next.m}`;
  const monthLabel = monthTitle(y, m - 1);
  const canSubmit = canSubmitMonthRome(y, m);
  const monthSubmitted = !!submission;
  const submittedAtLabel = submission
    ? submission.submittedAt.toLocaleDateString("it-IT", {
        day: "numeric",
        month: "long",
        timeZone: "Europe/Rome",
      })
    : null;

  return (
    <MesePageClient
      year={y}
      month={m}
      monthPrefix={prefix}
      monthLabel={monthLabel}
      prevHref={prevHref}
      nextHref={nextHref}
      selectedDay={selectedDay}
      serverEntries={entries}
      monthSubmitted={monthSubmitted}
      submittedAtLabel={submittedAtLabel}
      canSubmit={canSubmit}
    />
  );
}
