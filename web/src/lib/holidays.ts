/**
 * Giorni festivi nazionali italiani — calcolati localmente, senza API.
 * Tutte date fisse tranne Pasqua e Lunedì dell'Angelo, ottenuti con l'algoritmo
 * del Computus (Meeus/Jones/Butcher). Funziona per qualsiasi anno, offline.
 *
 * Le chiavi sono ISO "YYYY-MM-DD" e combaciano con quelle usate altrove
 * (todayISO / calendario), così il confronto è corretto per l'Italia.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Domenica di Pasqua (calendario gregoriano). month: 1-12. */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = aprile
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

const FIXED: ReadonlyArray<[month: number, day: number, name: string]> = [
  [1, 1, "Capodanno"],
  [1, 6, "Epifania"],
  [4, 25, "Festa della Liberazione"],
  [5, 1, "Festa dei Lavoratori"],
  [6, 2, "Festa della Repubblica"],
  [8, 15, "Ferragosto"],
  [11, 1, "Tutti i Santi"],
  [12, 8, "Immacolata Concezione"],
  [12, 25, "Natale"],
  [12, 26, "Santo Stefano"],
];

const cache = new Map<number, Record<string, string>>();

/** Mappa ISO → nome dei festivi nazionali per l'anno indicato. */
export function italianHolidaysForYear(year: number): Record<string, string> {
  const cached = cache.get(year);
  if (cached) return cached;

  const map: Record<string, string> = {};
  for (const [m, d, name] of FIXED) map[iso(year, m, d)] = name;

  const e = easterSunday(year);
  map[iso(year, e.month, e.day)] = "Pasqua";
  // Lunedì dell'Angelo = Pasqua + 1 (gestisce il cambio mese via Date UTC).
  const monday = new Date(Date.UTC(year, e.month - 1, e.day + 1));
  map[iso(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate())] =
    "Lunedì dell'Angelo";

  cache.set(year, map);
  return map;
}

/** Nome del festivo per una data ISO, o null se non è festivo. */
export function italianHolidayName(isoDate: string): string | null {
  const year = Number(isoDate.slice(0, 4));
  if (!Number.isFinite(year)) return null;
  return italianHolidaysForYear(year)[isoDate] ?? null;
}
