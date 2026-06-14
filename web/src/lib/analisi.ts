import { romeCalendarParts } from "@/lib/format";

/**
 * Aggregazioni per la dashboard Analisi (admin in-app). Funzioni pure: nessun
 * accesso a DB/DOM, così sono riusabili e testabili. Le date sono stringhe
 * "YYYY-MM-DD" → si lavora con string-slicing (tz-safe, coerente con
 * monthFromDate in month-lock.ts).
 *
 * Replica la parte "sum-per-dimensione" del foglio Google (statistiche-sheet.ts):
 * ore per lavorazione / luogo / dipendente, più i KPI.
 */

export type AnalisiEntry = {
  date: string; // "YYYY-MM-DD"
  hours: number;
  mansione: string; // → Ore per Lavorazione
  luogo: string; // → Ore per Luogo
  area: string; // "" ammesso → "Senza settore" (uso v2)
  userId: string;
};

export type AnalisiUser = { id: string; displayName: string };

export type Filters = {
  year: number;
  month: number | null; // 1..12, oppure null = "Tutti"
  userId: string | null; // id utente, oppure null = "Tutti"
  settore?: string | null; // nome settore, oppure null/undefined = "Tutti"
};

export type GroupRow = {
  label: string;
  hours: number; // somma
  count: number; // n° voci
  avg: number; // ore medie per voce
};

export type Kpis = {
  oreTotali: number;
  numInterventi: number; // n° voci nel set filtrato
  mediaIntervento: number; // oreTotali / numInterventi (0-safe)
  dipendentiAttivi: number; // userId distinti nel set filtrato
  giorniLavorati: number; // date distinte nel set filtrato
  mediaGiornaliera: number; // oreTotali / giorniLavorati (0-safe)
};

const EMPTY_SETTORE = "Senza settore";

/** Anni distinti presenti, ordinati desc. Fallback all'anno corrente se vuoto. */
export function availableYears(entries: AnalisiEntry[]): number[] {
  const years = new Set<number>();
  for (const e of entries) {
    const y = Number(e.date.slice(0, 4));
    if (Number.isFinite(y)) years.add(y);
  }
  if (years.size === 0) return [romeCalendarParts().y];
  return [...years].sort((a, b) => b - a);
}

/** Dipendenti che hanno almeno una voce, ordinati per nome (it-IT). */
export function employeesWithEntries(
  entries: AnalisiEntry[],
  users: AnalisiUser[],
): AnalisiUser[] {
  const withEntries = new Set(entries.map((e) => e.userId));
  return users
    .filter((u) => withEntries.has(u.id))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "it"));
}

/** Applica i filtri anno + mese + dipendente. */
export function filterEntries(
  entries: AnalisiEntry[],
  f: Filters,
): AnalisiEntry[] {
  const yearStr = String(f.year);
  return entries.filter((e) => {
    if (e.date.slice(0, 4) !== yearStr) return false;
    if (f.month != null && Number(e.date.slice(5, 7)) !== f.month) return false;
    if (f.userId != null && e.userId !== f.userId) return false;
    if (f.settore != null && (e.area.trim() || EMPTY_SETTORE) !== f.settore)
      return false;
    return true;
  });
}

/**
 * Raggruppa e somma le ore per la dimensione estratta da `key`. Valori
 * vuoti → `emptyLabel`. Ordina per ore desc (a parità, etichetta asc).
 */
export function groupSum(
  entries: AnalisiEntry[],
  key: (e: AnalisiEntry) => string,
  emptyLabel = EMPTY_SETTORE,
): GroupRow[] {
  const map = new Map<string, { hours: number; count: number }>();
  for (const e of entries) {
    const label = key(e).trim() || emptyLabel;
    const cur = map.get(label) ?? { hours: 0, count: 0 };
    cur.hours += e.hours;
    cur.count += 1;
    map.set(label, cur);
  }
  return [...map.entries()]
    .map(([label, { hours, count }]) => ({
      label,
      hours,
      count,
      avg: count ? hours / count : 0,
    }))
    .sort((a, b) => b.hours - a.hours || a.label.localeCompare(b.label, "it"));
}

export function hoursByLavorazione(entries: AnalisiEntry[]): GroupRow[] {
  return groupSum(entries, (e) => e.mansione);
}

export function hoursByLuogo(entries: AnalisiEntry[]): GroupRow[] {
  // v2: le voci multi-luogo "A, B, C" sono trattate come una singola etichetta
  // (come il group by del foglio). Eventuale split/ripartizione ore in futuro.
  return groupSum(entries, (e) => e.luogo);
}

export function hoursByDipendente(
  entries: AnalisiEntry[],
  users: AnalisiUser[],
): GroupRow[] {
  const names = new Map(users.map((u) => [u.id, u.displayName]));
  return groupSum(entries, (e) => names.get(e.userId) ?? "Sconosciuto");
}

export function hoursBySettore(entries: AnalisiEntry[]): GroupRow[] {
  return groupSum(entries, (e) => e.area);
}

export const MONTHS_SHORT = [
  "Gen",
  "Feb",
  "Mar",
  "Apr",
  "Mag",
  "Giu",
  "Lug",
  "Ago",
  "Set",
  "Ott",
  "Nov",
  "Dic",
];

/**
 * Andamento mensile: 12 righe (Gen…Dic) con le ore sommate. `entries` è già
 * filtrato per anno (+ dipendente); il filtro Mese NON si applica qui.
 */
export function monthlyTrend(
  entries: AnalisiEntry[],
): { label: string; hours: number }[] {
  const sums = new Array(12).fill(0);
  for (const e of entries) {
    const m = Number(e.date.slice(5, 7));
    if (m >= 1 && m <= 12) sums[m - 1] += e.hours;
  }
  return MONTHS_SHORT.map((label, i) => ({
    label,
    hours: Math.round(sums[i] * 100) / 100,
  }));
}

export type Seasonality = {
  data: Array<Record<string, number | string>>; // { mese, <settore>: ore, … }
  settori: string[]; // serie ordinate per ore desc
};

/**
 * Stagionalità mese × settore per il grafico a colonne impilate. `entries` già
 * filtrato per anno (+ dipendente). 12 righe (Gen…Dic), una serie per settore.
 */
export function seasonalityByMonthSettore(
  entries: AnalisiEntry[],
): Seasonality {
  const totals = new Map<string, number>();
  const byMonth: Array<Map<string, number>> = Array.from(
    { length: 12 },
    () => new Map(),
  );
  for (const e of entries) {
    const m = Number(e.date.slice(5, 7));
    if (m < 1 || m > 12) continue;
    const s = e.area.trim() || EMPTY_SETTORE;
    totals.set(s, (totals.get(s) ?? 0) + e.hours);
    byMonth[m - 1].set(s, (byMonth[m - 1].get(s) ?? 0) + e.hours);
  }
  const settori = [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it"))
    .map(([s]) => s);
  const data = MONTHS_SHORT.map((label, i) => {
    const row: Record<string, number | string> = { mese: label };
    for (const s of settori) {
      row[s] = Math.round((byMonth[i].get(s) ?? 0) * 100) / 100;
    }
    return row;
  });
  return { data, settori };
}

/**
 * Palette brand per le serie (settori). Scala perceptualmente coerente in oklch
 * (lightness/chroma simili, hue distinte) così le 8 serie restano nel mondo
 * earthy del brand ma sono distinguibili a colpo d'occhio nel donut/stacked.
 * Olive e terra restano i primi due (coerenti con OLIVE/TERRA in AnalisiClient).
 */
export const SETTORE_COLORS = [
  "oklch(0.50 0.07 120)", // olive (brand)
  "oklch(0.48 0.11 35)", // terra (brand)
  "oklch(0.62 0.10 75)", // ocra/senape
  "oklch(0.60 0.07 150)", // salvia (verde chiaro, ≠ olive)
  "oklch(0.58 0.12 50)", // ruggine
  "oklch(0.55 0.07 230)", // blu polvere
  "oklch(0.52 0.08 330)", // prugna
  "oklch(0.63 0.09 95)", // oro
];

export function computeKpis(entries: AnalisiEntry[]): Kpis {
  let oreTotali = 0;
  const users = new Set<string>();
  const days = new Set<string>();
  for (const e of entries) {
    oreTotali += e.hours;
    users.add(e.userId);
    days.add(e.date);
  }
  const giorniLavorati = days.size;
  const numInterventi = entries.length;
  return {
    oreTotali,
    numInterventi,
    mediaIntervento: numInterventi ? oreTotali / numInterventi : 0,
    dipendentiAttivi: users.size,
    giorniLavorati,
    mediaGiornaliera: giorniLavorati ? oreTotali / giorniLavorati : 0,
  };
}
