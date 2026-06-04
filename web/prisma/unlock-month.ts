/**
 * Reopen a submitted month: delete MonthSubmission + riga Chiusura su Ore Totali + refresh Presenze tab.
 *
 *   npm run db:unlock-month -- rocco 2026-06
 */
import { PrismaClient } from "@prisma/client";
import { removeMonthClosureFromSheet } from "../src/lib/google-sheets";
import { syncEmployeePresenzeTab } from "../src/lib/sync-presenze-sheet";

const prisma = new PrismaClient();

async function main() {
  const handle = process.argv[2]?.trim().toLowerCase();
  const month = process.argv[3]?.trim();
  if (!handle || !month || !/^\d{4}-\d{2}$/.test(month)) {
    console.error("Uso: npm run db:unlock-month -- <handle> <YYYY-MM>");
    console.error("Es.: npm run db:unlock-month -- rocco 2026-06");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { handle },
    select: { id: true, displayName: true, email: true },
  });
  if (!user) {
    console.error(`Utente "${handle}" non trovato.`);
    process.exit(1);
  }

  const deleted = await prisma.monthSubmission.deleteMany({
    where: { userId: user.id, month },
  });
  console.log(`DB: ${deleted.count} MonthSubmission rimossa/e (${user.displayName}, ${month})`);

  const sheet = await removeMonthClosureFromSheet(user, month);
  if (!sheet.ok) {
    console.error("Sheets:", sheet.error);
    process.exit(1);
  }
  console.log(`Sheets Ore Totali: ${sheet.deleted} riga/e Chiusura rimossa/e`);

  const presenze = await syncEmployeePresenzeTab(user.id);
  if (!presenze.ok) {
    console.error("Presenze:", presenze.error);
    process.exit(1);
  }
  if (presenze.skipped) {
    console.log("Presenze: nessun dato da aggiornare");
  } else {
    console.log(`Presenze: tab "${presenze.tab}" aggiornato`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
