import { cache } from "react";
import { romeCalendarParts } from "@/lib/format";
import { prisma } from "@/lib/prisma";

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

/** Month not submitted and date within current calendar month (Rome). */
export async function assertEntryDateAllowed(
  userId: string,
  date: string,
): Promise<{ ok: true; month: string } | { ok: false; error: string }> {
  if (!isDateInCurrentMonthRome(date)) {
    return {
      ok: false,
      error: `Puoi inserire ore solo nel mese in corso (${currentMonthLabelRome()}).`,
    };
  }
  const lock = await assertMonthEditable(userId, date);
  if (lock.locked) {
    return {
      ok: false,
      error: "Mese già inviato. Non puoi aggiungere o modificare lavori.",
    };
  }
  return { ok: true, month: lock.month };
}
