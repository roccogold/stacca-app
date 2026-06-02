import curiosita from "@/data/curiosita-settimana.json";

function romeLocalDate(d = new Date()): Date {
  const iso = d.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day);
}

/** ISO week 1–53 in Europe/Rome (new item each Monday). */
function isoWeekRome(d = new Date()): number {
  const date = romeLocalDate(d);
  const target = new Date(date);
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.getTime();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
}

/** Same curiosity Mon–Sun; changes each ISO week. */
export function getCuriositaForWeek(d = new Date()): string {
  const week = isoWeekRome(d);
  return curiosita[(week - 1) % curiosita.length] ?? curiosita[0]!;
}
