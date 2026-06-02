import { prisma } from "@/lib/prisma";

export function monthFromDate(date: string): string {
  return date.slice(0, 7);
}

export function isValidMonthKey(month: string): boolean {
  return /^\d{4}-\d{2}$/.test(month);
}

export async function getMonthSubmission(userId: string, month: string) {
  return prisma.monthSubmission.findUnique({
    where: { userId_month: { userId, month } },
  });
}

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
