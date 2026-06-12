import Link from "next/link";
import { Suspense } from "react";
import { PartyPopper } from "lucide-react";
import { DailyInspiration } from "@/components/DailyInspiration";
import { HomeTodaySection } from "@/components/HomeTodaySection";
import { MonthSubmitReminder } from "@/components/MonthSubmitReminder";
import { StaccaLogo } from "@/components/StaccaLogo";
import { ProfileIconLink } from "@/components/ProfileIconLink";
import { getMonthSubmission } from "@/lib/month-lock";
import { getMonthSubmitReminder } from "@/lib/month-reminder";
import { requireUser } from "@/lib/auth";
import {
  formatHoursIt,
  formatMonthYearIt,
  formatWeekdayLongFromISO,
  romeCalendarParts,
  todayISO,
} from "@/lib/format";
import { italianHolidayName } from "@/lib/holidays";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const user = await requireUser();
  const today = todayISO();
  const todayHoliday = italianHolidayName(today);
  const { y: romeY, m: romeM } = romeCalendarParts();
  const monthPrefix = `${romeY}-${String(romeM).padStart(2, "0")}`;

  const [todayEntries, monthAgg, monthSubmission, monthReminder] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { userId: user.id, date: today },
      orderBy: { createdAt: "asc" },
    }),
    prisma.timeEntry.aggregate({
      where: { userId: user.id, date: { startsWith: monthPrefix } },
      _sum: { hours: true },
    }),
    getMonthSubmission(user.id, monthPrefix),
    getMonthSubmitReminder(user.id),
  ]);

  const monthTotal = monthAgg._sum.hours ?? 0;
  const greeting = user.displayName.split(" ")[0] || user.displayName;
  const monthTitleCase = formatMonthYearIt().replace(/^\w/, (c) => c.toUpperCase());

  return (
    <>
      <header className="page-header">
        <StaccaLogo />
        <ProfileIconLink />
      </header>

      <section className="block block--home-intro">
        <div className="home-intro__head">
          <h1 className="h1">Ciao {greeting}</h1>
          <p className="date-line capitalize">
            {formatWeekdayLongFromISO(today)}
          </p>
          {todayHoliday && (
            <p className="date-holiday">
              <PartyPopper size={14} strokeWidth={2.5} aria-hidden />
              {todayHoliday}
            </p>
          )}
        </div>
        <Suspense fallback={null}>
          <DailyInspiration />
        </Suspense>
      </section>

      {monthReminder && (
        <section className="block">
          <MonthSubmitReminder reminder={monthReminder} />
        </section>
      )}

      <HomeTodaySection
        today={today}
        serverTodayEntries={todayEntries}
        monthLocked={!!monthSubmission}
      />

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

    </>
  );
}
