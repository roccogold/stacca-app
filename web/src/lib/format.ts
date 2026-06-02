const it = "it-IT";

export function formatHoursIt(n: number): string {
  return n.toLocaleString(it, { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

export function parseHoursInput(s: string): number | null {
  const t = s.replace(",", ".").trim();
  const v = Number(t);
  if (Number.isNaN(v) || v < 0 || v > 24) return null;
  return v;
}

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
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

export function formatWeekdayLong(d: Date): string {
  return d.toLocaleDateString(it, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatShortWeekday(d: Date): string {
  return d.toLocaleDateString(it, {
    weekday: "short",
    day: "numeric",
    month: "short",
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
