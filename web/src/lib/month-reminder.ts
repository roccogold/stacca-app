import { cache } from "react";
import { getMonthSubmission, currentMonthKeyRome } from "@/lib/month-lock";
import { prisma } from "@/lib/prisma";
import { romeCalendarParts } from "@/lib/format";

/** Ultimo giorno di calendario del mese corrente (Europe/Rome). */
function isLastDayOfCurrentMonthRome(): boolean {
  const { y, m, d } = romeCalendarParts();
  const lastDay = new Date(y, m, 0).getDate();
  return d === lastDay;
}

async function monthHasLoggedHours(userId: string, monthKey: string): Promise<boolean> {
  const agg = await prisma.timeEntry.aggregate({
    where: { userId, date: { startsWith: monthKey } },
    _sum: { hours: true },
  });
  return (agg._sum.hours ?? 0) > 0;
}

export function monthKeyFromParts(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function prevMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  let pm = m - 1;
  let py = y;
  if (pm < 1) {
    pm = 12;
    py -= 1;
  }
  return monthKeyFromParts(py, pm);
}

export function formatMonthLabelFromKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Rome",
  });
}

export type MonthSubmitReminder = {
  monthKey: string;
  monthLabel: string;
  href: string;
};

/**
 * Promemoria in home:
 * - mese precedente: non inviato + ore registrate (qualsiasi giorno, finché non invii);
 * - mese corrente: solo ultimo giorno di calendario + ore + non inviato.
 */
export const getMonthSubmitReminder = cache(
  async (userId: string): Promise<MonthSubmitReminder | null> => {
    const currentKey = currentMonthKeyRome();
    const prevKey = prevMonthKey(currentKey);

    const [prevSubmission, currentSubmission, prevHasHours, currentHasHours] =
      await Promise.all([
        getMonthSubmission(userId, prevKey),
        getMonthSubmission(userId, currentKey),
        monthHasLoggedHours(userId, prevKey),
        monthHasLoggedHours(userId, currentKey),
      ]);

    if (!prevSubmission && prevHasHours) {
      const [y, m] = prevKey.split("-").map(Number);
      return {
        monthKey: prevKey,
        monthLabel: formatMonthLabelFromKey(prevKey),
        href: `/mese?y=${y}&m=${m}`,
      };
    }

    if (
      !currentSubmission &&
      currentHasHours &&
      isLastDayOfCurrentMonthRome()
    ) {
      const [y, m] = currentKey.split("-").map(Number);
      return {
        monthKey: currentKey,
        monthLabel: formatMonthLabelFromKey(currentKey),
        href: `/mese?y=${y}&m=${m}`,
      };
    }

    return null;
  },
);
