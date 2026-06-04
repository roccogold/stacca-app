import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import type { TimeEntry, User } from "@prisma/client";
import { formatHoursIt } from "@/lib/format";
import { logError } from "@/lib/log-error";
import { monthFromDate } from "@/lib/month-lock";

const ENTRY_ID_COL = 11;

export type SheetEntryRow = {
  entryId?: string;
  date: string;
  displayName: string;
  email: string;
  hours: number;
  mansione: string;
  luogo: string;
  note: string;
  month: string;
  recordedAt: string;
  tipo: "Voce" | "Chiusura";
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
    r.entryId ?? "",
  ];
}

function sheetTabName(): string {
  return process.env.GOOGLE_SHEETS_TAB?.trim() || "Ore Totali";
}

function sheetDataRange(): string {
  return `${sheetTabName()}!A:L`;
}

export function buildEntrySheetRow(
  user: Pick<User, "displayName" | "email">,
  entry: TimeEntry,
  recordedAt = new Date(),
): SheetEntryRow {
  return {
    entryId: entry.id,
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
    tipo: "Chiusura",
  };
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

export function loadServiceAccountCredentials():
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

  const sheets = getSheetsClient(config);
  const values = rows.map(rowToValues);

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: config.sheetId,
      range: `${sheetTabName()}!A:L`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
    await applyOreTotaliTabLayout();
    return { ok: true };
  } catch (err) {
    logError("google-sheets", err);
    return {
      ok: false,
      error: "Errore nell'invio a Google Sheets. Riprova più tardi.",
    };
  }
}

function parseSheetHours(value: unknown): number | null {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function legacyRowMatchesEntry(
  row: unknown[],
  user: Pick<User, "email">,
  snapshot: TimeEntry,
): boolean {
  if (String(row[ENTRY_ID_COL] ?? "").trim()) return false;
  if (String(row[0] ?? "") !== snapshot.date) return false;
  if (String(row[2] ?? "").trim().toLowerCase() !== (user.email ?? "").trim().toLowerCase()) {
    return false;
  }
  if (String(row[10] ?? "") !== "Voce") return false;
  if (String(row[5] ?? "") !== snapshot.mansione) return false;
  if (String(row[6] ?? "") !== snapshot.luogo) return false;
  const h = parseSheetHours(row[4]);
  if (h == null || Math.abs(h - snapshot.hours) > 0.01) return false;
  return true;
}

function findEntryRowIndex(
  rows: unknown[][],
  entryId: string,
  user: Pick<User, "email">,
  legacySnapshot?: TimeEntry,
): number | null {
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][ENTRY_ID_COL] ?? "").trim() === entryId) return i;
  }
  if (legacySnapshot) {
    for (let i = 1; i < rows.length; i++) {
      if (legacyRowMatchesEntry(rows[i], user, legacySnapshot)) return i;
    }
  }
  return null;
}

async function getTabSheetId(
  sheets: ReturnType<typeof getSheetsClient>,
  spreadsheetId: string,
  tab: string,
): Promise<number | null> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === tab);
  const sheetId = sheet?.properties?.sheetId;
  return sheetId == null ? null : sheetId;
}

/** Create or update the row for this entry (matched by ID column). */
export async function upsertEntryToSheet(
  user: Pick<User, "displayName" | "email">,
  entry: TimeEntry,
  options?: { previous?: TimeEntry },
): Promise<{ ok: true; skipped?: boolean } | { ok: false; error: string }> {
  const config = getServiceAccountConfig();
  if (!config.ok) return { ok: true, skipped: true };

  await ensureSheetHeader();
  const row = buildEntrySheetRow(user, entry, new Date());

  if (!options?.previous) {
    return appendRowsToSheet([row]);
  }

  const tab = sheetTabName();
  const sheets = getSheetsClient(config);

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: sheetDataRange(),
    });
    const rows = (res.data.values ?? []) as unknown[][];
    const idx = findEntryRowIndex(rows, entry.id, user, options?.previous);

    if (idx != null) {
      const sheetRow = idx + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: config.sheetId,
        range: `${tab}!A${sheetRow}:L${sheetRow}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [rowToValues(row)] },
      });
      await applyOreTotaliTabLayout();
      return { ok: true };
    }

    return appendRowsToSheet([row]);
  } catch (err) {
    logError("google-sheets upsert", err);
    return {
      ok: false,
      error: "Errore nell'invio a Google Sheets. Riprova più tardi.",
    };
  }
}

/** Remove the sheet row for this entry. */
export async function deleteEntryFromSheet(
  user: Pick<User, "email">,
  entry: TimeEntry,
): Promise<{ ok: true; skipped?: boolean } | { ok: false; error: string }> {
  const config = getServiceAccountConfig();
  if (!config.ok) return { ok: true, skipped: true };

  const tab = sheetTabName();
  const sheets = getSheetsClient(config);

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: sheetDataRange(),
    });
    const rows = (res.data.values ?? []) as unknown[][];
    const idx = findEntryRowIndex(rows, entry.id, user, entry);
    if (idx == null) return { ok: true };

    const sheetId = await getTabSheetId(sheets, config.sheetId, tab);
    if (sheetId == null) {
      return { ok: false, error: `Tab "${tab}" non trovato nel foglio.` };
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.sheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: "ROWS",
                startIndex: idx,
                endIndex: idx + 1,
              },
            },
          },
        ],
      },
    });
    await applyOreTotaliTabLayout();
    return { ok: true };
  } catch (err) {
    logError("google-sheets delete-entry", err);
    return {
      ok: false,
      error: "Errore nella rimozione da Google Sheets.",
    };
  }
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

const SHEET_MONTH_COL = 8;
const SHEET_TIPO_COL = 10;

function rowMatchesUser(
  row: unknown[],
  user: Pick<User, "displayName" | "email">,
): boolean {
  const email = (user.email ?? "").trim().toLowerCase();
  const name = user.displayName.trim().toLowerCase();
  const rowEmail = String(row[2] ?? "").trim().toLowerCase();
  const rowName = String(row[1] ?? "").trim().toLowerCase();
  return (email && rowEmail === email) || (name && rowName === name);
}

/** Remove closure row(s) for user+month (e.g. when reopening a submitted month). */
export async function removeMonthClosureFromSheet(
  user: Pick<User, "displayName" | "email">,
  month: string,
): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  const config = getServiceAccountConfig();
  if (!config.ok) return { ok: true, deleted: 0 };

  const tab = sheetTabName();
  const sheets = getSheetsClient(config);

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: sheetDataRange(),
    });
    const rows = (res.data.values ?? []) as unknown[][];
    const toDelete: number[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const tipo = String(row[SHEET_TIPO_COL] ?? "");
      if (tipo !== "Chiusura" && tipo !== "Chiusura mese") continue;
      if (String(row[SHEET_MONTH_COL] ?? "") !== month) continue;
      if (!rowMatchesUser(row, user)) continue;
      toDelete.push(i);
    }

    if (toDelete.length === 0) {
      return { ok: true, deleted: 0 };
    }

    const sheetId = await getTabSheetId(sheets, config.sheetId, tab);
    if (sheetId == null) {
      return { ok: false, error: `Tab "${tab}" non trovato nel foglio.` };
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
    logError("google-sheets remove-month-closure", err);
    return {
      ok: false,
      error: "Errore nella rimozione chiusura mese da Google Sheets.",
    };
  }
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

  const tab = sheetTabName();
  const sheets = getSheetsClient(config);

  try {
    const sheetId = await getTabSheetId(sheets, config.sheetId, tab);
    if (sheetId == null) {
      return { ok: false, error: `Tab "${tab}" non trovato nel foglio.` };
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: sheetDataRange(),
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
    logError("google-sheets delete", err);
    return {
      ok: false,
      error: "Errore nella rimozione da Google Sheets.",
    };
  }
}

const ORE_TOTALI_COL_COUNT = 12;

let sheetHeaderEnsured = false;

/** Riga intestazione bloccata + filtri su tutto il tab Ore Totali. */
export async function applyOreTotaliTabLayout(): Promise<void> {
  const config = getServiceAccountConfig();
  if (!config.ok) return;

  const tab = sheetTabName();
  const sheets = getSheetsClient(config);

  try {
    const tabSheetId = await getTabSheetId(sheets, config.sheetId, tab);
    if (tabSheetId == null) return;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: sheetDataRange(),
    });
    const rowCount = Math.max(1, (res.data.values ?? []).length);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: config.sheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: tabSheetId,
                gridProperties: {
                  frozenRowCount: 1,
                  frozenColumnCount: 0,
                },
              },
              fields:
                "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
            },
          },
          {
            setBasicFilter: {
              filter: {
                range: {
                  sheetId: tabSheetId,
                  startRowIndex: 0,
                  endRowIndex: rowCount,
                  startColumnIndex: 0,
                  endColumnIndex: ORE_TOTALI_COL_COUNT,
                },
              },
            },
          },
        ],
      },
    });
  } catch (err) {
    logError("google-sheets ore-totali layout", err);
  }
}

export async function ensureSheetHeader(): Promise<void> {
  const config = getServiceAccountConfig();
  if (!config.ok) return;

  const tab = sheetTabName();
  const sheets = getSheetsClient(config);

  try {
    if (!sheetHeaderEnsured) {
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: config.sheetId,
        range: `${tab}!A1:L1`,
      });

      const header = existing.data.values?.[0] ?? [];
      if (header.length < 12) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: config.sheetId,
          range: `${tab}!A1:L1`,
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
                "ID",
              ],
            ],
          },
        });
      }
      sheetHeaderEnsured = true;
    }

    await applyOreTotaliTabLayout();
  } catch (err) {
    logError("google-sheets header", err);
  }
}
