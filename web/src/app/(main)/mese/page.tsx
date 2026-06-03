import Link from "next/link";
import { EntryCardLink } from "@/components/EntryCardLink";
import { MonthCalendar } from "@/components/MonthCalendar";
import { SubmitMonthPanel } from "@/components/SubmitMonthPanel";
import { getMonthSubmission } from "@/lib/month-lock";
import { requireUser } from "@/lib/auth";
import {
  formatHoursIt,
  formatShortWeekdayFromISO,
  formatWeekdayLongFromISO,
  monthTitle,
  romeCalendarParts,
  sharePercentages,
} from "@/lib/format";
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

  const totalsByDay: Record<string, number> = {};
  for (const e of entries) {
    totalsByDay[e.date] = (totalsByDay[e.date] ?? 0) + e.hours;
  }

  const monthTotal = entries.reduce((a, e) => a + e.hours, 0);

  const dayEntries = selectedDay
    ? entries.filter((e) => e.date === selectedDay)
    : [];
  const dayTotal = selectedDay ? (totalsByDay[selectedDay] ?? 0) : 0;
  const byMansione = new Map<string, number>();
  const byLuogo = new Map<string, number>();
  for (const e of entries) {
    byMansione.set(e.mansione, (byMansione.get(e.mansione) ?? 0) + e.hours);
    byLuogo.set(e.luogo, (byLuogo.get(e.luogo) ?? 0) + e.hours);
  }

  const mansioniSorted = [...byMansione.entries()].sort((a, b) => b[1] - a[1]);
  const luoghiSorted = [...byLuogo.entries()].sort((a, b) => b[1] - a[1]);
  const mansioniSharePct = sharePercentages(
    mansioniSorted.map(([, hrs]) => hrs),
    monthTotal,
  );
  const luoghiSharePct = sharePercentages(
    luoghiSorted.map(([, hrs]) => hrs),
    monthTotal,
  );

  const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  const prevHref = `/mese?y=${prev.y}&m=${prev.m}`;
  const nextHref = `/mese?y=${next.y}&m=${next.m}`;
  const monthLabel = monthTitle(y, m - 1);

  const canSubmit =
    y < now.getFullYear() ||
    (y === now.getFullYear() && m <= now.getMonth() + 1);

  const grouped = new Map<string, typeof entries>();
  for (const e of entries) {
    if (selectedDay && e.date !== selectedDay) continue;
    if (!grouped.has(e.date)) grouped.set(e.date, []);
    grouped.get(e.date)!.push(e);
  }
  const dates = [...grouped.keys()].sort((a, b) => (a < b ? 1 : -1));

  const lavoriDayLabel =
    dayEntries.length === 1 ? "1 lavoro" : `${dayEntries.length} lavori`;

  const monthSubmitted = !!submission;
  const submittedAtLabel = submission
    ? submission.submittedAt.toLocaleDateString("it-IT", {
        day: "numeric",
        month: "long",
        timeZone: "Europe/Rome",
      })
    : null;

  return (
    <>
      <MonthCalendar
        year={y}
        month={m}
        totalsByDay={totalsByDay}
        selectedDay={selectedDay}
        prevHref={prevHref}
        nextHref={nextHref}
        title={monthLabel}
      />

      <section className="block">
        <div className="card card--accent card--oggi">
          {selectedDay ? (
            <>
              <div className="card--oggi__label capitalize">
                {formatWeekdayLongFromISO(selectedDay)}
              </div>
              <div className="card--oggi__filled">
                <span className="card--oggi__num--duration">{formatHoursIt(dayTotal)}</span>
                <span
                  className={
                    monthSubmitted ? "badge badge--submitted-accent" : "badge badge--on-accent"
                  }
                >
                  {monthSubmitted ? "Inviato" : "Aperto"}
                </span>
              </div>
              {dayEntries.length > 0 && (
                <div className="card--oggi__unit">{lavoriDayLabel}</div>
              )}
              {dayEntries.length === 0 && (
                <div className="card--oggi__unit">nessun lavoro</div>
              )}
            </>
          ) : (
            <>
              <div className="card--oggi__label">MESE</div>
              <div className="card--oggi__filled">
                <span className="card--oggi__num--duration">{formatHoursIt(monthTotal)}</span>
                <span
                  className={
                    monthSubmitted ? "badge badge--submitted-accent" : "badge badge--on-accent"
                  }
                >
                  {monthSubmitted ? "Inviato" : "Aperto"}
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      <SubmitMonthPanel
        month={prefix}
        monthLabel={monthLabel}
        monthTotal={monthTotal}
        hasEntries={entries.length > 0}
        canSubmit={canSubmit}
        submitted={monthSubmitted}
        submittedAt={submittedAtLabel}
      />

      {!selectedDay && mansioniSorted.length > 0 && (
        <section className="block">
          <h2 className="section-title section-title--inset">Per lavorazione</h2>
          <div className="card card--stats">
            {mansioniSorted.map(([label, hrs], i) => {
              const sharePct = mansioniSharePct[i] ?? 0;
              const barPct = sharePct;
              return (
                <div key={label} className="stat-row">
                  <div className="stat-row__top">
                    <span className="stat-row__label">{label}</span>
                    <span className="stat-row__value">
                      {formatHoursIt(hrs)} · {sharePct}%
                    </span>
                  </div>
                  <div className="stat-row__bar">
                    <div
                      className="stat-row__bar-fill stat-row__bar-fill--olive"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!selectedDay && luoghiSorted.length > 0 && (
        <section className="block">
          <h2 className="section-title section-title--inset">Per luogo</h2>
          <div className="card card--stats">
            {luoghiSorted.map(([label, hrs], i) => {
              const sharePct = luoghiSharePct[i] ?? 0;
              const barPct = sharePct;
              return (
                <div key={label} className="stat-row">
                  <div className="stat-row__top">
                    <span className="stat-row__label">{label}</span>
                    <span className="stat-row__value">
                      {formatHoursIt(hrs)} · {sharePct}%
                    </span>
                  </div>
                  <div className="stat-row__bar">
                    <div
                      className="stat-row__bar-fill stat-row__bar-fill--olive"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="block">
        <h2 className="section-title section-title--inset">Lavori</h2>
        {dates.length === 0 ? (
          <p className="empty-list">Nessun lavoro.</p>
        ) : (
          <div className="entry-groups">
            {dates.map((date) => {
              const list = grouped.get(date)!;
              const dayTotal = list.reduce((a, e) => a + e.hours, 0);
              return (
                <div key={date} className="entry-group">
                  <div className="entry-group__head">
                    <span className="entry-group__date capitalize">
                      {formatShortWeekdayFromISO(date)}
                    </span>
                    <span className="entry-group__total">{formatHoursIt(dayTotal)}</span>
                  </div>
                  <ul className="entry-list">
                    {list.map((e) => (
                      <li key={e.id}>
                        <EntryCardLink
                          href={monthSubmitted ? undefined : `/aggiungi?edit=${e.id}`}
                          readOnly={monthSubmitted}
                          hours={e.hours}
                          mansione={e.mansione}
                          luogo={e.luogo}
                          compact
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
