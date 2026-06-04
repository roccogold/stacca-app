import { google } from "googleapis";
import { loadServiceAccountCredentials } from "@/lib/google-sheets";
import { logError } from "@/lib/log-error";
import { monthFromDate } from "@/lib/month-lock";
import {
  buildPresenzeSheetValues,
  employeePresenzeTabName,
  isPresenzeBlankRow,
  isPresenzeColumnHeaderRow,
  isPresenzeMonthBandRow,
  legacyPresenzeTabName,
  type PresenzeMonthBlock,
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

async function renamePresenzeTabIfExists(
  sheets: ReturnType<typeof getSheetsClient>,
  spreadsheetId: string,
  fromTitle: string,
  toTitle: string,
): Promise<void> {
  if (fromTitle === toTitle) return;

  const fromId = await getTabSheetId(sheets, spreadsheetId, fromTitle);
  if (fromId == null) return;

  const toId = await getTabSheetId(sheets, spreadsheetId, toTitle);
  if (toId != null) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId: fromId, title: toTitle },
            fields: "title",
          },
        },
      ],
    },
  });
}

async function ensurePresenzeTab(
  sheets: ReturnType<typeof getSheetsClient>,
  spreadsheetId: string,
  tab: string,
): Promise<number> {
  const existing = await getTabSheetId(sheets, spreadsheetId, tab);
  if (existing != null) return existing;

  const res = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tab } } }],
    },
  });
  const id = res.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (id == null) throw new Error(`Impossibile creare il tab "${tab}".`);
  return id;
}

const PRESENZE_COL_WIDTHS = [96, 88, 56, 128, 148, 200, 108, 72];

async function applyPresenzeTabFormatting(
  sheets: ReturnType<typeof getSheetsClient>,
  spreadsheetId: string,
  tabSheetId: number,
  values: (string | number)[][],
): Promise<void> {
  const requests: object[] = [];

  for (let c = 0; c < PRESENZE_COL_WIDTHS.length; c++) {
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId: tabSheetId,
          dimension: "COLUMNS",
          startIndex: c,
          endIndex: c + 1,
        },
        properties: { pixelSize: PRESENZE_COL_WIDTHS[c] },
        fields: "pixelSize",
      },
    });
  }

  let headerRowIndex = -1;

  for (let r = 0; r < values.length; r++) {
    const row = values[r] ?? [];
    let pixelSize = 30;

    if (isPresenzeBlankRow(row)) {
      pixelSize = 14;
    } else if (isPresenzeColumnHeaderRow(row)) {
      headerRowIndex = r;
      pixelSize = 38;
    } else if (isPresenzeMonthBandRow(row)) {
      pixelSize = 34;
    } else if (row[0] === "Azienda" || row[0] === "Dipendente") {
      pixelSize = 26;
    }

    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId: tabSheetId,
          dimension: "ROWS",
          startIndex: r,
          endIndex: r + 1,
        },
        properties: { pixelSize },
        fields: "pixelSize",
      },
    });
  }

  if (values.length > 0) {
    requests.push({
      repeatCell: {
        range: {
          sheetId: tabSheetId,
          startRowIndex: 0,
          endRowIndex: values.length,
          startColumnIndex: 0,
          endColumnIndex: 8,
        },
        cell: {
          userEnteredFormat: {
            horizontalAlignment: "LEFT",
            verticalAlignment: "MIDDLE",
            backgroundColor: { red: 1, green: 1, blue: 1 },
            textFormat: { foregroundColor: { red: 0, green: 0, blue: 0 } },
          },
        },
        fields:
          "userEnteredFormat(horizontalAlignment,verticalAlignment,backgroundColor,textFormat)",
      },
    });
  }

  if (headerRowIndex >= 0) {
    requests.push({
      repeatCell: {
        range: {
          sheetId: tabSheetId,
          startRowIndex: headerRowIndex,
          endRowIndex: headerRowIndex + 1,
          startColumnIndex: 0,
          endColumnIndex: 8,
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            horizontalAlignment: "LEFT",
          },
        },
        fields: "userEnteredFormat(textFormat,horizontalAlignment)",
      },
    });
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId: tabSheetId,
          gridProperties: { frozenRowCount: headerRowIndex + 1 },
        },
        fields: "gridProperties.frozenRowCount",
      },
    });
    requests.push({
      setBasicFilter: {
        filter: {
          range: {
            sheetId: tabSheetId,
            startRowIndex: headerRowIndex,
            endRowIndex: values.length,
            startColumnIndex: 0,
            endColumnIndex: 8,
          },
        },
      },
    });
  }

  for (let r = 0; r < values.length; r++) {
    if (!isPresenzeMonthBandRow(values[r] ?? [])) continue;
    requests.push({
      repeatCell: {
        range: {
          sheetId: tabSheetId,
          startRowIndex: r,
          endRowIndex: r + 1,
          startColumnIndex: 0,
          endColumnIndex: 8,
        },
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            horizontalAlignment: "LEFT",
          },
        },
        fields: "userEnteredFormat(textFormat,horizontalAlignment)",
      },
    });
  }

  const batchSize = 80;
  for (let i = 0; i < requests.length; i += batchSize) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: requests.slice(i, i + batchSize) },
    });
  }
}

async function writePresenzeTab(
  tab: string,
  values: (string | number)[][],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sheetId = process.env.GOOGLE_SHEETS_ID?.trim();
  const creds = loadServiceAccountCredentials();
  if (!sheetId || !creds.ok) {
    return { ok: true };
  }

  const sheets = getSheetsClient(creds);

  try {
    const tabSheetId = await ensurePresenzeTab(sheets, sheetId, tab);
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: `${tab}!A:Z`,
    });
    if (values.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${tab}!A1`,
        // RAW: evita che Sheets interpreti "Giugno 2026" come data (→ "giugno 2026")
        valueInputOption: "RAW",
        requestBody: { values },
      });
      await applyPresenzeTabFormatting(sheets, sheetId, tabSheetId, values);
    }
    return { ok: true };
  } catch (err) {
    logError("google-sheets presenze", err);
    return {
      ok: false,
      error: "Errore nel foglio presenze su Google Sheets. Riprova più tardi.",
    };
  }
}

async function loadPresenzeBlocks(userId: string): Promise<PresenzeMonthBlock[]> {
  const submissions = await prisma.monthSubmission.findMany({
    where: { userId },
    orderBy: { month: "asc" },
  });
  const submittedByMonth = new Map(
    submissions.map((s) => [s.month, s.submittedAt] as const),
  );

  const dateRows = await prisma.timeEntry.findMany({
    where: { userId },
    select: { date: true },
  });
  const months = new Set<string>(submittedByMonth.keys());
  for (const { date } of dateRows) {
    months.add(monthFromDate(date));
  }

  const sortedMonths = [...months].sort();
  const blocks: PresenzeMonthBlock[] = [];

  await Promise.all(
    sortedMonths.map(async (month) => {
      const monthEntries = await prisma.timeEntry.findMany({
        where: { userId, date: { startsWith: month } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      });
      if (monthEntries.length === 0) return;

      const submittedAt = submittedByMonth.get(month) ?? null;
      blocks.push({
        month,
        stato: submittedAt ? "Chiuso" : "Bozza",
        submittedAt,
        entries: monthEntries,
      });
    }),
  );

  blocks.sort((a, b) => a.month.localeCompare(b.month));
  return blocks;
}

/** Rebuild worker tab (Presenze Nome) from DB — bozze + mesi chiusi. */
export async function syncEmployeePresenzeTab(
  userId: string,
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

  const blocks = await loadPresenzeBlocks(userId);
  if (blocks.length === 0) {
    return { ok: true, skipped: true };
  }

  const values = buildPresenzeSheetValues(user, blocks);
  const tab = employeePresenzeTabName(user);
  const sheets = getSheetsClient(creds);
  const legacy = legacyPresenzeTabName(user);
  if (legacy) {
    await renamePresenzeTabIfExists(sheets, sheetId, legacy, tab);
  }
  const written = await writePresenzeTab(tab, values);
  if (!written.ok) return written;

  return { ok: true, tab };
}

/** Call after entry create/update/delete (non-blocking). */
export async function refreshPresenzeTabAfterEntryChange(
  userId: string,
): Promise<void> {
  const res = await syncEmployeePresenzeTab(userId);
  if (!res.ok) {
    console.error("[presenze refresh]", res.error, { userId });
  }
}
