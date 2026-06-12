"use client";

import Link from "next/link";
import { PartyPopper } from "lucide-react";
import { MonthCalendar } from "@/components/MonthCalendar";
import { SubmitMonthPanel } from "@/components/SubmitMonthPanel";
import { MeseEntriesList, MeseOfflineBanner, useMergedMonthStats } from "@/components/MeseOfflineSection";
import {
  formatHoursIt,
  formatWeekdayLongFromISO,
} from "@/lib/format";
import { italianHolidayName } from "@/lib/holidays";

type ServerEntry = {
  id: string;
  date: string;
  hours: number;
  mansione: string;
  luogo: string;
  note: string | null;
};

type Props = {
  year: number;
  month: number;
  monthPrefix: string;
  monthLabel: string;
  prevHref: string;
  nextHref: string;
  selectedDay: string | null;
  serverEntries: ServerEntry[];
  monthSubmitted: boolean;
  submittedAtLabel: string | null;
  canSubmit: boolean;
};

export function MesePageClient({
  year,
  month,
  monthPrefix,
  monthLabel,
  prevHref,
  nextHref,
  selectedDay,
  serverEntries,
  monthSubmitted,
  submittedAtLabel,
  canSubmit,
}: Props) {
  const {
    totalsByDay,
    monthTotal,
    mansioniSorted,
    luoghiSorted,
    mansioniSharePct,
    luoghiSharePct,
    entries,
  } = useMergedMonthStats(serverEntries, monthPrefix);

  const dayEntries = selectedDay
    ? entries.filter((e) => e.date === selectedDay)
    : [];
  const dayTotal = selectedDay ? (totalsByDay[selectedDay] ?? 0) : 0;
  const lavoriDayLabel =
    dayEntries.length === 1 ? "1 lavoro" : `${dayEntries.length} lavori`;

  return (
    <>
      <MonthCalendar
        year={year}
        month={month}
        totalsByDay={totalsByDay}
        selectedDay={selectedDay}
        prevHref={prevHref}
        nextHref={nextHref}
        title={monthLabel}
      />

      <MeseOfflineBanner />

      <section className="block">
        <div className="card card--accent card--oggi">
          {selectedDay ? (
            <>
              <div className="card--oggi__label capitalize">
                {formatWeekdayLongFromISO(selectedDay)}
              </div>
              {italianHolidayName(selectedDay) && (
                <div className="card--oggi__holiday">
                  <PartyPopper size={14} strokeWidth={2.5} aria-hidden />
                  {italianHolidayName(selectedDay)}
                </div>
              )}
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
              {!monthSubmitted && (
                <Link
                  href={`/aggiungi?date=${encodeURIComponent(selectedDay)}`}
                  className="card--oggi__cta"
                  prefetch
                >
                  Aggiungi ore
                </Link>
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
        month={monthPrefix}
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
                      style={{ width: `${sharePct}%` }}
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
                      style={{ width: `${sharePct}%` }}
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
        <MeseEntriesList
          monthPrefix={monthPrefix}
          serverEntries={serverEntries}
          monthSubmitted={monthSubmitted}
          selectedDay={selectedDay}
        />
      </section>
    </>
  );
}
