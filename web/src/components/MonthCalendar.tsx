import Link from "next/link";
import { ChevronLeft, ChevronRight, PartyPopper } from "lucide-react";
import { daysInMonth, mondayWeekdayIndex, todayISO } from "@/lib/format";
import { italianHolidaysForYear } from "@/lib/holidays";

type Props = {
  year: number;
  month: number;
  totalsByDay: Record<string, number>;
  selectedDay: string | null;
  prevHref: string;
  nextHref: string;
  title: string;
};

const DOW = ["L", "M", "M", "G", "V", "S", "D"] as const;
const DOW_KEYS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"] as const;

export function MonthCalendar({
  year,
  month,
  totalsByDay,
  selectedDay,
  prevHref,
  nextHref,
  title,
}: Props) {
  const dim = daysInMonth(year, month - 1);
  const first = new Date(year, month - 1, 1);
  const pad = mondayWeekdayIndex(first);
  const cells: (number | null)[] = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const today = todayISO();
  const holidays = italianHolidaysForYear(year);

  return (
    <>
      <header className="cal-page-nav">
        <Link href={prevHref} className="cal-nav__btn" aria-label="Mese precedente">
          <ChevronLeft size={20} />
        </Link>
        <h2 className="cal-nav__title capitalize">{title}</h2>
        <Link href={nextHref} className="cal-nav__btn" aria-label="Mese successivo">
          <ChevronRight size={20} />
        </Link>
      </header>

      <section className="block block--tight">
        <div className="card cal-card">
          <div className="cal-grid cal-grid--header">
            {DOW.map((d, i) => (
              <div key={DOW_KEYS[i]} className="cal-dow">
                {d}
              </div>
            ))}
          </div>
          <div className="cal-grid">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`e-${i}`} className="cal-cell cal-cell--empty" aria-hidden />;
              }
              const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const has = (totalsByDay[key] ?? 0) > 0;
              const isSel = selectedDay === key;
              const isToday = key === today;
              const holiday = holidays[key];
              let cls = "cal-cell";
              if (has) cls += " cal-cell--has";
              if (holiday) cls += " cal-cell--holiday";
              if (isSel) cls += " cal-cell--selected";
              else if (isToday) cls += " cal-cell--today";
              const href =
                isSel ? `/mese?y=${year}&m=${month}` : `/mese?y=${year}&m=${month}&d=${key}`;
              const ariaParts = [
                key,
                isToday ? "oggi" : null,
                holiday ? `festivo: ${holiday}` : null,
                has ? "con ore" : "nessuna ora",
                isSel ? "selezionato" : null,
              ].filter(Boolean);
              return (
                <Link
                  key={key}
                  href={href}
                  className={cls}
                  aria-label={ariaParts.join(", ")}
                >
                  {holiday ? (
                    <span className="cal-cell__holiday" aria-hidden>
                      <PartyPopper size={14} strokeWidth={2.25} />
                    </span>
                  ) : (
                    <span className="cal-cell__num">{day}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
