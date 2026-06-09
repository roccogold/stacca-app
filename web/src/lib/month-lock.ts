import { cache } from "react";
import { romeCalendarParts, todayISO } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const EDITABLE_MONTHS_LOOKBACK = 36;

function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  let nm = m + delta;
  let ny = y;
  while (nm < 1) {
    nm += 12;
    ny -= 1;
  }
  while (nm > 12) {
    nm -= 12;
    ny += 1;
  }
  return { y: ny, m: nm };
}

function monthKeyFromParts(y: number, m: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function monthFromDate(date: string): string {
  return date.slice(0, 7);
}

/** First and last calendar day of the current month (Europe/Rome). */
export function currentMonthDateBoundsRome(): { min: string; max: string } {
  const { y, m } = romeCalendarParts();
  const mm = String(m).padStart(2, "0");
  const last = new Date(y, m, 0).getDate();
  return {
    min: `${y}-${mm}-01`,
    max: `${y}-${mm}-${String(last).padStart(2, "0")}`,
  };
}

export function currentMonthKeyRome(): string {
  const { y, m } = romeCalendarParts();
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function isDateInCurrentMonthRome(date: string): boolean {
  return monthFromDate(date) === currentMonthKeyRome();
}

export function currentMonthLabelRome(): string {
  const { y, m } = romeCalendarParts();
  return new Date(y, m - 1, 1).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Rome",
  });
}

export function isValidMonthKey(month: string): boolean {
  return /^\d{4}-\d{2}$/.test(month);
}

/** Whether month YYYY-MM can be submitted (current or past month, Europe/Rome). */
export function canSubmitMonthRome(year: number, month: number): boolean {
  const rome = romeCalendarParts();
  return year < rome.y || (year === rome.y && month <= rome.m);
}

export const getMonthSubmission = cache(async (userId: string, month: string) => {
  return prisma.monthSubmission.findUnique({
    where: { userId_month: { userId, month } },
  });
});

export async function isMonthLocked(userId: string, month: string): Promise<boolean> {
  const sub = await getMonthSubmission(userId, month);
  return !!sub;
}

export async function assertMonthEditable(userId: string, date: string) {
  const month = monthFromDate(date);
  if (await isMonthLocked(userId, month)) {
    return { locked: true as const, month };
  }
  return { locked: false as const, month };
}

/** First/last selectable day: any open (non-submitted) month in lookback, through today (Rome). */
export async function getEditableDateBoundsRome(
  userId: string,
): Promise<{ min: string; max: string }> {
  const max = todayISO();
  const submitted = await prisma.monthSubmission.findMany({
    where: { userId },
    select: { month: true },
  });
  const submittedMonths = new Set(submitted.map((s) => s.month));
  const { y, m } = romeCalendarParts();

  let min: string | null = null;
  for (let i = EDITABLE_MONTHS_LOOKBACK - 1; i >= 0; i--) {
    const { y: yy, m: mm } = shiftMonth(y, m, -i);
    const key = monthKeyFromParts(yy, mm);
    if (submittedMonths.has(key)) continue;
    const first = `${key}-01`;
    if (min === null || first < min) min = first;
  }

  if (min === null) {
    min = `${monthKeyFromParts(y, m)}-01`;
  }

  return { min, max };
}

/** Open month only; no future dates. Submitted months stay locked. */
export async function assertEntryDateAllowed(
  userId: string,
  date: string,
): Promise<{ ok: true; month: string } | { ok: false; error: string }> {
  if (date > todayISO()) {
    return {
      ok: false,
      error: "Non puoi registrare ore in un giorno futuro.",
    };
  }
  const lock = await assertMonthEditable(userId, date);
  if (lock.locked) {
    return {
      ok: false,
      error: "Mese già inviato. Non puoi aggiungere o modificare lavori.",
    };
  }
  const bounds = await getEditableDateBoundsRome(userId);
  if (date < bounds.min) {
    return {
      ok: false,
      error: "Questo mese è già chiuso o troppo indietro nel tempo.",
    };
  }
  return { ok: true, month: lock.month };
}
