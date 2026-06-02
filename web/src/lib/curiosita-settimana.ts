import { unstable_cache } from "next/cache";
import curiosita from "@/data/curiosita-settimana.json";

type RomeDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function romeDateTimeParts(d = new Date()): RomeDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    year: Number.parseInt(get("year"), 10),
    month: Number.parseInt(get("month"), 10),
    day: Number.parseInt(get("day"), 10),
    hour: Number.parseInt(get("hour"), 10),
    minute: Number.parseInt(get("minute"), 10),
    weekday: WEEKDAY[get("weekday")] ?? 0,
  };
}

/** Monday 00:00 (Rome calendar) that started the current Lo sapevi? period. */
function mondaySixAmAnchor(d = new Date()): Date {
  const { year, month, day, hour, minute, weekday } = romeDateTimeParts(d);
  const minutes = hour * 60 + minute;
  let daysSinceMonday = (weekday + 6) % 7;
  if (weekday === 1 && minutes < 6 * 60) daysSinceMonday += 7;

  const anchor = new Date(year, month - 1, day);
  anchor.setDate(anchor.getDate() - daysSinceMonday);
  return anchor;
}

function isoWeekFromDate(date: Date): number {
  const target = new Date(date);
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.getTime();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
}

/** Cache key: Rome date of the Monday 6:00 that opened this period. */
export function curiositaWeekId(d = new Date()): string {
  const anchor = mondaySixAmAnchor(d);
  const y = anchor.getFullYear();
  const m = String(anchor.getMonth() + 1).padStart(2, "0");
  const day = String(anchor.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function secondsUntilNextCuriositaUpdate(d = new Date()): number {
  const { hour, minute, weekday } = romeDateTimeParts(d);
  const minuteFromSunMidnight = weekday * 24 * 60 + hour * 60 + minute;
  const mondaySixAmFromSunMidnight = 1 * 24 * 60 + 6 * 60;
  let minutesUntil = mondaySixAmFromSunMidnight - minuteFromSunMidnight;
  if (minutesUntil <= 0) minutesUntil += 7 * 24 * 60;
  return minutesUntil * 60;
}

function pickCuriosita(d = new Date()): string {
  const week = isoWeekFromDate(mondaySixAmAnchor(d));
  return curiosita[(week - 1) % curiosita.length] ?? curiosita[0]!;
}

/** Same curiosity until next Monday 6:00 Europe/Rome. */
export function getCuriositaForWeek(d = new Date()): string {
  return pickCuriosita(d);
}

export async function getCuriositaForWeekCached(d = new Date()): Promise<string> {
  const weekId = curiositaWeekId(d);

  return unstable_cache(
    () => Promise.resolve(pickCuriosita(d)),
    ["curiosita-settimana", weekId],
    { revalidate: secondsUntilNextCuriositaUpdate(d) },
  )();
}
