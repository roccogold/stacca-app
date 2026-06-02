import detti from "@/data/detti-toscani.json";

/** Giorno 1–366 → indice 0–359 (360 detti, si ripete ogni ~6 anni negli anni bisestili). */
export function dayIndexForDate(d: Date = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return (dayOfYear - 1) % detti.length;
}

export function getDettoForDate(d: Date = new Date()): string {
  return detti[dayIndexForDate(d)] ?? detti[0]!;
}
