import Link from "next/link";
import { Plus } from "lucide-react";
import { DailyInspiration } from "@/components/DailyInspiration";
import { EntryCardLink } from "@/components/EntryCardLink";
import { StaccaLogo } from "@/components/StaccaLogo";
import { ProfileIconLink } from "@/components/ProfileIconLink";
import { getMonthSubmission } from "@/lib/month-lock";
import { requireUser } from "@/lib/auth";
import { formatHoursIt, formatWeekdayLong, parseISODate, todayISO } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const user = await requireUser();
  const today = todayISO();
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [todayEntries, monthEntries, monthSubmission] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { userId: user.id, date: today },
      orderBy: { createdAt: "asc" },
    }),
    prisma.timeEntry.findMany({
      where: { userId: user.id, date: { startsWith: monthPrefix } },
    }),
    getMonthSubmission(user.id, monthPrefix),
  ]);

  const todayTotal = todayEntries.reduce((a, e) => a + e.hours, 0);
  const monthTotal = monthEntries.reduce((a, e) => a + e.hours, 0);
  const todayLabel = parseISODate(today);
  const greeting = user.displayName.split(" ")[0] || user.displayName;
  const monthName = now.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const monthTitleCase = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const vociLabel =
    todayEntries.length === 1 ? "1 voce" : `${todayEntries.length} voci`;

  return (
    <>
      <header className="page-header">
        <StaccaLogo />
        <ProfileIconLink />
      </header>

      <section className="block block--greeting">
        <h1 className="h1">Ciao, {greeting}</h1>
        <p className="date-line capitalize">
          {todayLabel ? formatWeekdayLong(todayLabel) : today}
        </p>
      </section>

      <DailyInspiration />

      <section className="block">
        <div className="card card--accent card--oggi">
          <div className="card--oggi__label">OGGI</div>
          {todayEntries.length === 0 ? (
            <p className="card--oggi__empty">
              Oggi è ancora vuoto — tocca <strong>+</strong> per inserire le ore.
            </p>
          ) : (
            <div className="card--oggi__filled">
              <div>
                <div className="card--oggi__num">{formatHoursIt(todayTotal)}</div>
                <div className="card--oggi__unit">ore registrate</div>
              </div>
              <span className="badge badge--on-accent">{vociLabel}</span>
            </div>
          )}
        </div>
      </section>

      {todayEntries.length > 0 && (
        <section className="block">
          <div className="section-title-row">
            <h2 className="section-title section-title--inset">Le voci di oggi</h2>
            {!monthSubmission && (
              <Link href="/aggiungi" className="section-title-row__action">
                + Altra voce
              </Link>
            )}
          </div>
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
            <div className="month-teaser__sub">{formatHoursIt(monthTotal)} ore totali</div>
          </div>
          <span className={monthSubmission ? "badge badge--locked" : "badge badge--open"}>
            {monthSubmission ? "Inviato" : "Aperto"}
          </span>
        </Link>
      </section>

      {!monthSubmission && (
        <Link href="/aggiungi" className="fab" aria-label="Aggiungi ore">
          <Plus size={32} strokeWidth={2.5} />
        </Link>
      )}
    </>
  );
}
