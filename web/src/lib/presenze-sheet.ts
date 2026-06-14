import type { TimeEntry, User } from "@prisma/client";
import {
  formatDateItFromISO,
  formatWeekdayNameFromISO,
  monthTitle,
} from "@/lib/format";

export type PresenzeMonthStato = "Bozza" | "Chiuso";

export type PresenzeMonthBlock = {
  month: string;
  stato: PresenzeMonthStato;
  submittedAt: Date | null;
  entries: TimeEntry[];
};

/** Prefix without trailing space — a single space is always added before the name. */
export function presenzeTabPrefix(): string {
  return process.env.GOOGLE_SHEETS_PRESENZE_TAB_PREFIX?.trim() || "Ore";
}

/** Prefissi usati in passato: i tab vengono rinominati al prefisso attuale. */
const LEGACY_TAB_PREFIXES = ["Presenze"];

function companyLabel(): string {
  return process.env.GOOGLE_SHEETS_COMPANY_NAME?.trim() || "Corzano e Paterno";
}

/** Google Sheets tab title (max 100 chars, no []:*?/\\). */
export function sanitizeSheetTabTitle(title: string): string {
  return title.replace(/[\\/?*[\]:]/g, "").trim().slice(0, 100);
}

export function employeePresenzeTabName(
  user: Pick<User, "displayName" | "handle">,
): string {
  const name = user.displayName.trim();
  return sanitizeSheetTabTitle(`${presenzeTabPrefix()} ${name}`);
}

/**
 * Nomi tab vecchi da rinominare al nome attuale ("Ore [Nome]"): i prefissi
 * storici ("Presenze [Nome]", "Presenze[Nome]") e la variante incollata del
 * prefisso attuale ("Ore[Nome]"). Esclude il nome canonico.
 */
export function legacyPresenzeTabNames(
  user: Pick<User, "displayName" | "handle">,
): string[] {
  const name = user.displayName.trim();
  const canonical = employeePresenzeTabName(user);
  const candidates = [
    ...LEGACY_TAB_PREFIXES.flatMap((p) => [
      sanitizeSheetTabTitle(`${p} ${name}`),
      sanitizeSheetTabTitle(`${p}${name}`),
    ]),
    sanitizeSheetTabTitle(`${presenzeTabPrefix()}${name}`),
  ];
  return [...new Set(candidates)].filter((c) => c !== canonical);
}

export function isPresenzeBlankRow(row: (string | number)[]): boolean {
  return row.length === 0 || row.every((c) => c === "" || c == null);
}

export function isPresenzeMonthBandRow(row: (string | number)[]): boolean {
  const first = String(row[0] ?? "");
  return first.startsWith("MESE:");
}

export function isPresenzeColumnHeaderRow(row: (string | number)[]): boolean {
  return row[0] === "Data";
}

/**
 * Tab Ore [Nome]: una riga per ogni lavorazione, con spaziatura tra sezioni.
 */
export function buildPresenzeSheetValues(
  user: Pick<User, "displayName">,
  blocks: PresenzeMonthBlock[],
): (string | number)[][] {
  const lines: (string | number)[][] = [
    ["Azienda", companyLabel()],
    ["Dipendente", user.displayName],
    [],
    [],
    ["Data", "Giorno", "Ore (h)", "Settore", "Lavorazione", "Luogo", "Note", "Mese", "Stato"],
    [],
  ];

  const sorted = [...blocks].sort((a, b) => a.month.localeCompare(b.month));
  let monthIndex = 0;

  for (const block of sorted) {
    if (block.entries.length === 0) continue;

    if (monthIndex > 0) {
      lines.push([], []);
    }
    monthIndex += 1;

    const [y, m] = block.month.split("-").map(Number);
    const monthLabel = monthTitle(y, m - 1);
    const stato = block.stato === "Chiuso" ? "Chiuso" : "Bozza";

    lines.push([`MESE: ${monthLabel}`, "", "", "", "", "", "", "", stato]);

    const entries = [...block.entries].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );

    for (const e of entries) {
      lines.push([
        formatDateItFromISO(e.date),
        formatWeekdayNameFromISO(e.date),
        Math.round(e.hours * 100) / 100,
        e.area,
        e.mansione,
        e.luogo,
        e.note ?? "",
        monthLabel,
        stato,
      ]);
    }
  }

  return lines;
}
