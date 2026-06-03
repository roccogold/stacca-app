import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import type { TimeEntry, User } from "@prisma/client";
import { formatHoursIt } from "@/lib/format";
import { monthFromDate } from "@/lib/month-lock";

export type SheetEntryRow = {
  date: string;
  displayName: string;
  email: string;
  hours: number;
  mansione: string;
  luogo: string;
  note: string;
  month: string;
  recordedAt: string;
  tipo: "Voce" | "Chiusura mese";
};

function recordedAtLabel(at: Date): string {
  return at.toLocaleString("it-IT", { timeZone: "Europe/Rome" });
}

function rowToValues(r: SheetEntryRow): (string | number)[] {
  return [
    r.date,
    r.displayName,
    r.email,
    formatHoursIt(r.hours),
    Math.round(r.hours * 100) / 100,
    r.mansione,
    r.luogo,
    r.note,
    r.month,
    r.recordedAt,
    r.tipo,
  ];
}

export function buildEntrySheetRow(
  user: Pick<User, "displayName" | "email">,
  entry: TimeEntry,
  recordedAt = new Date(),
): SheetEntryRow {
  return {
    date: entry.date,
    displayName: user.displayName,
    email: user.email ?? "",
    hours: entry.hours,
    mansione: entry.mansione,
    luogo: entry.luogo,
    note: entry.note ?? "",
    month: monthFromDate(entry.date),
    recordedAt: recordedAtLabel(recordedAt),
    tipo: "Voce",
  };
}

export function buildMonthClosureSheetRow(
  user: Pick<User, "displayName" | "email">,
  month: string,
  totalHours: number,
  submittedAt: Date,
): SheetEntryRow {
  const day = submittedAt.toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
  return {
    date: day,
    displayName: user.displayName,
    email: user.email ?? "",
    hours: totalHours,
    mansione: "—",
    luogo: "—",
    note: "Mese chiuso",
    month,
    recordedAt: recordedAtLabel(submittedAt),
    tipo: "Chiusura mese",
  };
}

/** @deprecated Bulk export; prefer appendEntryToSheet on each save. */
export function buildSheetRows(
  user: Pick<User, "displayName" | "email">,
  entries: TimeEntry[],
  month: string,
  submittedAt: Date,
): SheetEntryRow[] {
  return entries.map((e) => ({
    ...buildEntrySheetRow(user, e, submittedAt),
    month,
    recordedAt: recordedAtLabel(submittedAt),
    tipo: "Voce" as const,
  }));
}

function parseServiceAccountJson(raw: string): {
  client_email?: string;
  private_key?: string;
} | null {
  try {
    return JSON.parse(raw) as { client_email?: string; private_key?: string };
  } catch {
    return null;
  }
}

function loadServiceAccountCredentials():
  | { ok: true; email: string; key: string }
  | { ok: false; error: string } {
  const jsonSetting = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonSetting) {
    const fromEnv =
      jsonSetting.startsWith("{") ? parseServiceAccountJson(jsonSetting) : null;

    if (fromEnv) {
      const email = fromEnv.client_email?.trim();
      const key = fromEnv.private_key?.trim();
      if (email && key) return { ok: true, email, key };
    } else {
      try {
        const fullPath = path.resolve(process.cwd(), jsonSetting);
        const creds = parseServiceAccountJson(
          fs.readFileSync(fullPath, "utf8"),
        );
        const email = creds?.client_email?.trim();
        const key = creds?.private_key?.trim();
        if (email && key) return { ok: true, email, key };
      } catch {
        return {
          ok: false,
          error:
            "Impossibile leggere GOOGLE_SERVICE_ACCOUNT_JSON. Verifica percorso file o JSON inline.",
        };
      }
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (email && key) return { ok: true, email, key };

  return {
    ok: false,
    error:
      "Google Sheets non configurato. Imposta GOOGLE_SERVICE_ACCOUNT_JSON (consigliato) oppure GOOGLE_SERVICE_ACCOUNT_EMAIL e GOOGLE_PRIVATE_KEY nel .env.",
  };
}

function getServiceAccountConfig():
  | { ok: true; email: string; key: string; sheetId: string }
  | { ok: false; error: string } {
  const sheetId = process.env.GOOGLE_SHEETS_ID?.trim();
  const creds = loadServiceAccountCredentials();

  if (!sheetId) {
    return {
      ok: false,
      error:
        "Google Sheets non configurato. Imposta GOOGLE_SHEETS_ID nel .env (dall'URL del foglio).",
    };
  }

  if (!creds.ok) return creds;

  return { ok: true, email: creds.email, key: creds.key, sheetId };
}

export async function appendRowsToSheet(
  rows: SheetEntryRow[],
): Promise<{ ok: true; skipped?: boolean } | { ok: false; error: string }> {
  const config = getServiceAccountConfig();
  if (!config.ok) return { ok: true, skipped: true };

  const tab = process.env.GOOGLE_SHEETS_TAB?.trim() || "Ore Totali";
  const range = `${tab}!A:K`;

  const sheets = getSheetsClient(config);
  const values = rows.map(rowToValues);

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.sheetId,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
    return { ok: true };
  } catch (err) {
    console.error("[google-sheets]", err);
    return {
      ok: false,
      error: "Errore nell'invio a Google Sheets. Riprova più tardi.",
    };
  }
}

/** One row per saved work entry (day by day). */
export async function appendEntryToSheet(
  user: Pick<User, "displayName" | "email">,
  entry: TimeEntry,
): Promise<{ ok: true; skipped?: boolean } | { ok: false; error: string }> {
  await ensureSheetHeader();
  return appendRowsToSheet([buildEntrySheetRow(user, entry)]);
}

/** Single closure row when the worker submits the month. */
export async function appendMonthClosureToSheet(
  user: Pick<User, "displayName" | "email">,
  month: string,
  totalHours: number,
  submittedAt: Date,
): Promise<{ ok: true; skipped?: boolean } | { ok: false; error: string }> {
  await ensureSheetHeader();
  return appendRowsToSheet([
    buildMonthClosureSheetRow(user, month, totalHours, submittedAt),
  ]);
}

function getSheetsClient(config: { email: string; key: string }) {
  const auth = new google.auth.JWT({
    email: config.email,
    key: config.key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

/** Remove all data rows for a user (by email or display name). Keeps header row. */
export async function deleteUserRowsFromSheet(match: {
  email?: string;
  displayName?: string;
}): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  const config = getServiceAccountConfig();
  if (!config.ok) return config;

  const emailNeedle = match.email?.trim().toLowerCase();
  const nameNeedle = match.displayName?.trim().toLowerCase();
  if (!emailNeedle && !nameNeedle) {
    return { ok: false, error: "Email o nome richiesti." };
  }

  const tab = process.env.GOOGLE_SHEETS_TAB?.trim() || "Ore Totali";
  const sheets = getSheetsClient(config);

  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: config.sheetId,
      fields: "sheets.properties",
    });
    const sheet = meta.data.sheets?.find((s) => s.properties?.title === tab);
    const sheetId = sheet?.properties?.sheetId;
    if (sheetId == null) {
      return { ok: false, error: `Tab "${tab}" non trovato nel foglio.` };
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: `${tab}!A:K`,
    });
    const rows = res.data.values ?? [];
    if (rows.length <= 1) {
      return { ok: true, deleted: 0 };
    }

    const toDelete: number[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const nome = String(row[1] ?? "").trim().toLowerCase();
      const email = String(row[2] ?? "").trim().toLowerCase();
      const hit =
        (emailNeedle && email === emailNeedle) ||
        (nameNeedle && nome === nameNeedle);
      if (hit) toDelete.push(i);
    }

    if (toDelete.length === 0) {
      return { ok: true, deleted: 0 };
    }

    const requests = [...toDelete]
      .sort((a, b) => b - a)
      .map((rowIndex) => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS" as const,
            startIndex: rowIndex,
            endIndex: rowIndex + 1,
          },
        },
      }));

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.sheetId,
      requestBody: { requests },
    });

    return { ok: true, deleted: toDelete.length };
  } catch (err) {
    console.error("[google-sheets] delete", err);
    return {
      ok: false,
      error: "Errore nella rimozione da Google Sheets.",
    };
  }
}

export async function ensureSheetHeader(): Promise<void> {
  const config = getServiceAccountConfig();
  if (!config.ok) return;

  const tab = process.env.GOOGLE_SHEETS_TAB?.trim() || "Ore Totali";
  const sheets = getSheetsClient(config);

  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: `${tab}!A1:K1`,
    });

    const header = existing.data.values?.[0] ?? [];
    if (header.length >= 11) return;

    await sheets.spreadsheets.values.update({
      spreadsheetId: config.sheetId,
      range: `${tab}!A1:K1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            "Data",
            "Nome",
            "Email",
            "Ore",
            "Ore (h)",
            "Lavorazione",
            "Luogo",
            "Note",
            "Mese",
            "Registrato il",
            "Tipo",
          ],
        ],
      },
    });
  } catch (err) {
    console.error("[google-sheets] header", err);
  }
}
