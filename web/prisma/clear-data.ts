/**
 * Wipe all TimeEntry + MonthSubmission rows and clear Google Sheet data rows.
 * Keeps User accounts. Local / ops only.
 *
 *   npm run db:clear-data
 */
import { PrismaClient } from "@prisma/client";
import { google } from "googleapis";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

async function clearSheetDataRows(): Promise<number> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID?.trim();
  const tab = process.env.GOOGLE_SHEETS_TAB?.trim() || "Ore Totali";
  let json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!spreadsheetId || !json) {
    console.log("Sheet: skipped (Google env not set)");
    return 0;
  }
  if (json.startsWith("./") || json.startsWith("../")) {
    json = fs.readFileSync(path.resolve(process.cwd(), json), "utf8");
  }
  const creds = JSON.parse(json) as { client_email: string; private_key: string };
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === tab);
  const tabSheetId = sheet?.properties?.sheetId;
  if (tabSheetId == null) throw new Error(`Tab not found: ${tab}`);

  const range = `'${tab.replace(/'/g, "''")}'!A:L`;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values ?? [];
  const dataRows = Math.max(0, rows.length - 1);
  if (dataRows === 0) {
    console.log(`Sheet: no data rows on "${tab}"`);
    return 0;
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: tabSheetId,
              dimension: "ROWS",
              startIndex: 1,
              endIndex: rows.length,
            },
          },
        },
      ],
    },
  });
  console.log(`Sheet: deleted ${dataRows} row(s) from "${tab}"`);
  return dataRows;
}

async function main() {
  const entries = await prisma.timeEntry.deleteMany();
  const months = await prisma.monthSubmission.deleteMany();
  const users = await prisma.user.count();
  console.log(
    `DB: deleted ${entries.count} TimeEntry, ${months.count} MonthSubmission (${users} users kept)`,
  );
  await clearSheetDataRows();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
