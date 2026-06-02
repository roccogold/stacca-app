import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import type { TimeEntry, User } from "@prisma/client";
import { formatHoursIt } from "@/lib/format";

export type SheetEntryRow = {
  date: string;
  displayName: string;
  email: string;
  hours: number;
  mansione: string;
  luogo: string;
  note: string;
  month: string;
  submittedAt: string;
};

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

export function buildSheetRows(
  user: Pick<User, "displayName" | "email">,
  entries: TimeEntry[],
  month: string,
  submittedAt: Date,
): SheetEntryRow[] {
  const submittedLabel = submittedAt.toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
  });

  return entries.map((e) => ({
    date: e.date,
    displayName: user.displayName,
    email: user.email ?? "",
    hours: e.hours,
    mansione: e.mansione,
    luogo: e.luogo,
    note: e.note ?? "",
    month,
    submittedAt: submittedLabel,
  }));
}

export async function appendRowsToSheet(
  rows: SheetEntryRow[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = getServiceAccountConfig();
  if (!config.ok) return config;

  const tab = process.env.GOOGLE_SHEETS_TAB?.trim() || "Ore";
  const range = `${tab}!A:I`;

  const auth = new google.auth.JWT({
    email: config.email,
    key: config.key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const values = rows.map((r) => [
    r.date,
    r.displayName,
    r.email,
    formatHoursIt(r.hours),
    r.mansione,
    r.luogo,
    r.note,
    r.month,
    r.submittedAt,
  ]);

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

export async function ensureSheetHeader(): Promise<void> {
  const config = getServiceAccountConfig();
  if (!config.ok) return;

  const tab = process.env.GOOGLE_SHEETS_TAB?.trim() || "Ore";
  const auth = new google.auth.JWT({
    email: config.email,
    key: config.key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: `${tab}!A1:I1`,
    });

    if (existing.data.values?.[0]?.length) return;

    await sheets.spreadsheets.values.update({
      spreadsheetId: config.sheetId,
      range: `${tab}!A1:I1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            "Data",
            "Nome",
            "Email",
            "Ore",
            "Lavorazione",
            "Luogo",
            "Note",
            "Mese",
            "Inviato il",
          ],
        ],
      },
    });
  } catch (err) {
    console.error("[google-sheets] header", err);
  }
}
