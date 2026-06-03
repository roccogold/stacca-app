import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { DailyInspiration } from "@/components/DailyInspiration";
import { EntryCardLink } from "@/components/EntryCardLink";
import { StaccaLogo } from "@/components/StaccaLogo";
import { ProfileIconLink } from "@/components/ProfileIconLink";
import { getMonthSubmission } from "@/lib/month-lock";
import { requireUser } from "@/lib/auth";
import {
  formatHoursIt,
  formatMonthYearIt,
  formatWeekdayLongFromISO,
  romeCalendarParts,
  todayISO,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const user = await requireUser();
  const today = todayISO();
  const { y: romeY, m: romeM } = romeCalendarParts();
  const monthPrefix = `${romeY}-${String(romeM).padStart(2, "0")}`;

  const [todayEntries, monthAgg, monthSubmission] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { userId: user.id, date: today },
      orderBy: { createdAt: "asc" },
    }),
    prisma.timeEntry.aggregate({
      where: { userId: user.id, date: { startsWith: monthPrefix } },
      _sum: { hours: true },
    }),
    getMonthSubmission(user.id, monthPrefix),
  ]);

  const todayTotal = todayEntries.reduce((a, e) => a + e.hours, 0);
  const monthTotal = monthAgg._sum.hours ?? 0;
  const greeting = user.displayName.split(" ")[0] || user.displayName;
  const monthTitleCase = formatMonthYearIt().replace(/^\w/, (c) => c.toUpperCase());
  const lavoriLabel =
    todayEntries.length === 1 ? "1 lavoro" : `${todayEntries.length} lavori`;

  return (
    <>
      <header className="page-header">
        <StaccaLogo />
        <ProfileIconLink />
      </header>

      <section className="block block--home-intro">
        <h1 className="h1">Ciao, {greeting}</h1>
        <p className="date-line capitalize">
          {formatWeekdayLongFromISO(today)}
        </p>
        <Suspense fallback={null}>
          <DailyInspiration />
        </Suspense>
      </section>

      <section className="block">
        <div className="card card--accent card--oggi">
          <div className="card--oggi__label">OGGI</div>
          {todayEntries.length === 0 ? (
            <p className="card--oggi__empty">
              Oggi è ancora vuoto — tocca <strong>+</strong> per inserire le ore.
            </p>
          ) : (
            <div className="card--oggi__filled">
              <span className="card--oggi__num--duration">{formatHoursIt(todayTotal)}</span>
              <span className="badge badge--on-accent">{lavoriLabel}</span>
            </div>
          )}
        </div>
      </section>

      {todayEntries.length > 0 && (
        <section className="block">
          <h2 className="section-title section-title--inset">I lavori di oggi</h2>
          <ul className="entry-list">
            {todayEntries.map((e) => (
              <li key={e.id}>
                <EntryCardLink
                  href={monthSubmission ? undefined : `/aggiungi?edit=${e.id}`}
                  readOnly={!!monthSubmission}
                  hours={e.hours}
                  mansione={e.mansione}
                  luogo={e.luogo}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="block">
        <Link href="/mese" className="month-teaser">
          <div>
            <div className="month-teaser__label">Questo mese</div>
            <div className="month-teaser__title capitalize">{monthTitleCase}</div>
            <div className="month-teaser__sub">{formatHoursIt(monthTotal)} totali</div>
          </div>
          <span className={monthSubmission ? "badge badge--locked" : "badge badge--open"}>
            {monthSubmission ? "Inviato" : "Aperto"}
          </span>
        </Link>
      </section>

      {!monthSubmission && (
        <Link href="/aggiungi" prefetch className="fab" aria-label="Aggiungi ore">
          <Plus size={32} strokeWidth={2.5} />
        </Link>
      )}
    </>
  );
}
