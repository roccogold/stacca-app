import { google } from "googleapis";
import { loadServiceAccountCredentials } from "@/lib/google-sheets";
import { logError } from "@/lib/log-error";
import {
  buildAllPresenzeRowsForUser,
  employeePresenzeTabName,
  PRESENZE_SHEET_HEADERS,
  presenzeRowToValues,
  type PresenzeSheetRow,
  type SubmittedMonthBlock,
} from "@/lib/presenze-sheet";
import { prisma } from "@/lib/prisma";

function getSheetsClient(config: { email: string; key: string }) {
  const auth = new google.auth.JWT({
    email: config.email,
    key: config.key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
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

async function ensurePresenzeTab(
  sheets: ReturnType<typeof getSheetsClient>,
  spreadsheetId: string,
  tab: string,
): Promise<void> {
  const existing = await getTabSheetId(sheets, spreadsheetId, tab);
  if (existing != null) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tab } } }],
    },
  });
}

async function writePresenzeTab(
  tab: string,
  presenzeRows: PresenzeSheetRow[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sheetId = process.env.GOOGLE_SHEETS_ID?.trim();
  const creds = loadServiceAccountCredentials();
  if (!sheetId || !creds.ok) {
    return { ok: true };
  }

  const sheets = getSheetsClient(creds);
  const values: (string | number)[][] = [
    [...PRESENZE_SHEET_HEADERS],
    ...presenzeRows.map(presenzeRowToValues),
  ];

  try {
    await ensurePresenzeTab(sheets, sheetId, tab);
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: `${tab}!A:Z`,
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tab}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    return { ok: true };
  } catch (err) {
    logError("google-sheets presenze", err);
    return {
      ok: false,
      error: "Errore nel foglio presenze su Google Sheets. Riprova più tardi.",
    };
  }
}

/** Rebuild worker tab (Presenze Nome) from all submitted months. */
export async function syncEmployeePresenzeTab(
  userId: string,
  options?: { appendMonth?: SubmittedMonthBlock },
): Promise<{ ok: true; skipped?: boolean; tab?: string } | { ok: false; error: string }> {
  const sheetId = process.env.GOOGLE_SHEETS_ID?.trim();
  const creds = loadServiceAccountCredentials();
  if (!sheetId || !creds.ok) {
    return { ok: true, skipped: true };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { handle: true, displayName: true, email: true },
  });
  if (!user) {
    return { ok: false, error: "Utente non trovato" };
  }

  const submissions = await prisma.monthSubmission.findMany({
    where: { userId },
    orderBy: { month: "asc" },
  });

  const blocks: SubmittedMonthBlock[] = [];
  for (const sub of submissions) {
    const entries = await prisma.timeEntry.findMany({
      where: { userId, date: { startsWith: sub.month } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
    blocks.push({
      month: sub.month,
      submittedAt: sub.submittedAt,
      entries,
    });
  }

  const pending = options?.appendMonth;
  if (pending && !blocks.some((b) => b.month === pending.month)) {
    blocks.push(pending);
  }

  if (blocks.length === 0) {
    return { ok: true, skipped: true };
  }

  const presenzeRows = buildAllPresenzeRowsForUser(user, blocks);
  const tab = employeePresenzeTabName(user);
  const written = await writePresenzeTab(tab, presenzeRows);
  if (!written.ok) return written;

  return { ok: true, tab };
}
