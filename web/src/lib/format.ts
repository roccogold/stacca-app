const it = "it-IT";

/** Manual stepper / chips still use quarter-hour steps. */
export const HOUR_STEP = 0.25;

export function stepHours(h: number, delta: number): number {
  const n = Math.round((h + delta) / HOUR_STEP) * HOUR_STEP;
  return Math.min(24, Math.max(0, n));
}

/** +/- 1 minute (manual mode). */
export function stepHoursByMinutes(h: number, deltaMinutes: number): number {
  const mins = Math.round(h * 60) + deltaMinutes;
  return Math.min(24 * 60, Math.max(0, mins)) / 60;
}

/** Stored hours: positive, max 24h, minute precision. */
export function isValidWorkHours(h: number): boolean {
  if (typeof h !== "number" || h <= 0 || h > 24) return false;
  const mins = Math.round(h * 60);
  return mins > 0 && mins <= 24 * 60 && Math.abs(h * 60 - mins) < 0.02;
}

/** Integer % per part, always sums to 100 (largest remainder). */
export function sharePercentages(parts: number[], total: number): number[] {
  if (total <= 0 || parts.length === 0) return parts.map(() => 0);
  const exact = parts.map((p) => (p / total) * 100);
  const floors = exact.map((e) => Math.floor(e));
  const rest = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => ({ i, frac: e - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (let k = 0; k < rest; k++) {
    out[order[k % order.length].i] += 1;
  }
  return out;
}

/** Pausa: "0", "45 min", "1 h", "1 h 5 min" */
export function formatBreakMinutesIt(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m === 0) return "0";
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min} min`;
  if (min === 0) return `${h} h`;
  return `${h} h ${min} min`;
}

export function stepBreakMinutes(current: number, delta: number, max: number): number {
  return Math.min(max, Math.max(0, Math.round(current + delta)));
}

const nbsp = "\u00A0";

/** e.g. "8 ore", "5 ore 3 min", "45 min" — nbsp keeps duration on one line in UI */
export function formatHoursIt(n: number): string {
  const totalMin = Math.round(n * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (totalMin <= 0) return `0${nbsp}ore`;
  if (m === 0) return `${h.toLocaleString(it)}${nbsp}ore`;
  if (h === 0) return `${m}${nbsp}min`;
  return `${h.toLocaleString(it)}${nbsp}ore${nbsp}${m}${nbsp}min`;
}

export function parseHoursInput(s: string): number | null {
  const t = s.replace(",", ".").trim();
  const v = Number(t);
  if (Number.isNaN(v) || v < 0 || v > 24) return null;
  return v;
}

const DAY_MINUTES = 24 * 60;

/** "07:30" → minutes from midnight, or null if invalid. */
export function parseTimeToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function minutesToTime(totalMins: number): string {
  const m = ((totalMins % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Worked minutes from start/end (end after start same day, or end before start = next day) minus break. */
export function workedMinutesFromTimeRange(
  start: string,
  end: string,
  breakMinutes: number,
): number | null {
  const s = parseTimeToMinutes(start);
  let e = parseTimeToMinutes(end);
  if (s === null || e === null) return null;
  if (breakMinutes < 0) return null;
  if (e === s) return null;
  if (e < s) e += DAY_MINUTES;
  const workMin = e - s - breakMinutes;
  if (workMin <= 0 || workMin >= 24 * 60) return null;
  return workMin;
}

/** Worked hours from start/end (minute precision). */
export function hoursFromTimeRange(
  start: string,
  end: string,
  breakMinutes: number,
): number | null {
  const workMin = workedMinutesFromTimeRange(start, end, breakMinutes);
  if (workMin === null) return null;
  return Math.round(workMin * 100) / 6000;
}

/** Guess start/end from stored hours (editing entries without saved times). */
export function defaultTimesFromHours(hours: number): {
  start: string;
  end: string;
  breakMinutes: number;
} {
  const startMin = 7 * 60;
  const workMin = Math.round(hours * 60);
  return {
    start: minutesToTime(startMin),
    end: minutesToTime(startMin + workMin),
    breakMinutes: 0,
  };
}

export function formatTimeIt(t: string): string {
  const m = parseTimeToMinutes(t);
  if (m === null) return t;
  return minutesToTime(m);
}

/** Calendar day in Europe/Rome (matches worker-facing dates in Italy). */
export function romeCalendarParts(at = new Date()): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  return {
    y: Number(parts.find((p) => p.type === "year")?.value),
    m: Number(parts.find((p) => p.type === "month")?.value),
    d: Number(parts.find((p) => p.type === "day")?.value),
  };
}

export function todayISO(): string {
  const { y, m, d } = romeCalendarParts();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function clampISODate(date: string, min: string, max: string): string {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Noon UTC on calendar day — safe anchor for Europe/Rome formatting. */
function isoDateAnchorUtc(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
}

const romeDateFmt = { timeZone: "Europe/Rome" as const };

export function formatWeekdayLongFromISO(iso: string): string {
  const d = isoDateAnchorUtc(iso);
  if (!d) return iso;
  return d.toLocaleDateString(it, {
    ...romeDateFmt,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatWeekdayLong(d: Date): string {
  return d.toLocaleDateString(it, {
    ...romeDateFmt,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatShortWeekdayFromISO(iso: string): string {
  const d = isoDateAnchorUtc(iso);
  if (!d) return iso;
  return d.toLocaleDateString(it, {
    ...romeDateFmt,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatShortWeekday(d: Date): string {
  return d.toLocaleDateString(it, {
    ...romeDateFmt,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Compact label for the date picker card, e.g. "2 giu 2026". */
export function formatDateField(iso: string): string {
  const d = isoDateAnchorUtc(iso);
  if (!d) return iso;
  return d.toLocaleDateString(it, {
    ...romeDateFmt,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatMonthYearIt(at = new Date()): string {
  return at.toLocaleDateString(it, {
    ...romeDateFmt,
    month: "long",
    year: "numeric",
  });
}

export function monthTitle(year: number, monthIndex0: number): string {
  const d = new Date(year, monthIndex0, 1);
  return d.toLocaleDateString(it, { month: "long", year: "numeric" });
}

/** First weekday index Mon=0..Sun=6 for calendar grid (Italian week starts Monday). */
export function mondayWeekdayIndex(d: Date): number {
  const js = d.getDay(); // Sun=0
  return js === 0 ? 6 : js - 1;
}

export function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}
