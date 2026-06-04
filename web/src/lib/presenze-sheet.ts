import type { TimeEntry, User } from "@prisma/client";
import {
  formatDateItFromISO,
  formatHoursIt,
  formatWeekdayNameFromISO,
  monthTitle,
} from "@/lib/format";

export type PresenzeRowTipo = "Intestazione" | "Giorno" | "Voce" | "Riepilogo";

export type PresenzeSheetRow = {
  month: string;
  displayName: string;
  email: string;
  date: string;
  weekday: string;
  dateIt: string;
  hoursText: string;
  hours: number;
  activities: string;
  places: string;
  notes: string;
  submittedAt: string;
  tipo: PresenzeRowTipo;
};

export const PRESENZE_SHEET_HEADERS = [
  "Mese",
  "Nome",
  "Email",
  "Data",
  "Giorno",
  "Data (IT)",
  "Ore",
  "Ore (h)",
  "Attività",
  "Luoghi",
  "Note",
  "Inviato il",
  "Tipo",
] as const;

function companyLabel(): string {
  return process.env.GOOGLE_SHEETS_COMPANY_NAME?.trim() || "Corzano e Paterno";
}

const TAB_PREFIX = () =>
  process.env.GOOGLE_SHEETS_PRESENZE_TAB_PREFIX?.trim() || "Presenze ";

/** Google Sheets tab title (max 100 chars, no []:*?/\\). */
export function sanitizeSheetTabTitle(title: string): string {
  return title.replace(/[\\/?*[\]:]/g, "").trim().slice(0, 100);
}

export function employeePresenzeTabName(
  user: Pick<User, "displayName" | "handle">,
): string {
  const prefix = TAB_PREFIX();
  return sanitizeSheetTabTitle(`${prefix}${user.displayName}`);
}

function joinUnique(items: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out.join("; ");
}

function submittedAtLabel(at: Date): string {
  return at.toLocaleString("it-IT", { timeZone: "Europe/Rome" });
}

type DayAggregate = {
  hours: number;
  mansioni: string[];
  luoghi: string[];
  notes: string[];
};

function aggregateByDate(entries: TimeEntry[]): Map<string, DayAggregate> {
  const map = new Map<string, DayAggregate>();
  for (const e of entries) {
    const cur = map.get(e.date) ?? {
      hours: 0,
      mansioni: [],
      luoghi: [],
      notes: [],
    };
    cur.hours += e.hours;
    cur.mansioni.push(e.mansione);
    cur.luoghi.push(e.luogo);
    if (e.note?.trim()) cur.notes.push(e.note.trim());
    map.set(e.date, cur);
  }
  return map;
}

export function presenzeRowToValues(r: PresenzeSheetRow): (string | number)[] {
  return [
    r.month,
    r.displayName,
    r.email,
    r.date,
    r.weekday,
    r.dateIt,
    r.hoursText,
    Math.round(r.hours * 100) / 100,
    r.activities,
    r.places,
    r.notes,
    r.submittedAt,
    r.tipo,
  ];
}

/** Standard monthly attendance rows for consultant / inspection (one row per worked day). */
export function buildPresenzeMeseRows(
  user: Pick<User, "displayName" | "email">,
  month: string,
  entries: TimeEntry[],
  submittedAt: Date,
): PresenzeSheetRow[] {
  const [y, m] = month.split("-").map(Number);
  const monthLabel = monthTitle(y, m - 1);
  const sentLabel = submittedAtLabel(submittedAt);
  const email = user.email ?? "";
  const byDay = aggregateByDate(entries);
  const dates = [...byDay.keys()].sort();
  const totalHours = entries.reduce((a, e) => a + e.hours, 0);

  const rows: PresenzeSheetRow[] = [
    {
      month,
      displayName: user.displayName,
      email,
      date: "",
      weekday: "",
      dateIt: "",
      hoursText: "",
      hours: 0,
      activities: `Azienda: ${companyLabel()}`,
      places: `Mese: ${monthLabel}`,
      notes: "Foglio presenze — generato da Stacca all'invio mese",
      submittedAt: sentLabel,
      tipo: "Intestazione",
    },
  ];

  for (const date of dates) {
    const day = byDay.get(date)!;
    rows.push({
      month,
      displayName: user.displayName,
      email,
      date,
      weekday: formatWeekdayNameFromISO(date),
      dateIt: formatDateItFromISO(date),
      hoursText: formatHoursIt(day.hours),
      hours: day.hours,
      activities: joinUnique(day.mansioni),
      places: joinUnique(day.luoghi),
      notes: day.notes.join(" · "),
      submittedAt: sentLabel,
      tipo: "Giorno",
    });
  }

  rows.push({
    month,
    displayName: user.displayName,
    email,
    date: "",
    weekday: "",
    dateIt: "",
    hoursText: formatHoursIt(totalHours),
    hours: totalHours,
    activities: `${dates.length} giorni lavorati`,
    places: "",
    notes: "Totale mese",
    submittedAt: sentLabel,
    tipo: "Riepilogo",
  });

  const sortedEntries = [...entries].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );
  for (const e of sortedEntries) {
    rows.push({
      month,
      displayName: user.displayName,
      email,
      date: e.date,
      weekday: formatWeekdayNameFromISO(e.date),
      dateIt: formatDateItFromISO(e.date),
      hoursText: formatHoursIt(e.hours),
      hours: e.hours,
      activities: e.mansione,
      places: e.luogo,
      notes: e.note?.trim() ?? "",
      submittedAt: sentLabel,
      tipo: "Voce",
    });
  }

  return rows;
}

export type SubmittedMonthBlock = {
  month: string;
  submittedAt: Date;
  entries: TimeEntry[];
};

/** All closed months for one worker — one tab, standard foglio presenze. */
export function buildAllPresenzeRowsForUser(
  user: Pick<User, "displayName" | "email">,
  months: SubmittedMonthBlock[],
): PresenzeSheetRow[] {
  const sorted = [...months].sort((a, b) => a.month.localeCompare(b.month));
  const out: PresenzeSheetRow[] = [];
  for (const block of sorted) {
    out.push(
      ...buildPresenzeMeseRows(
        user,
        block.month,
        block.entries,
        block.submittedAt,
      ),
    );
  }
  return out;
}
