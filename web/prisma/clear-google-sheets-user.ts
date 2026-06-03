import { PrismaClient } from "@prisma/client";
import { deleteUserRowsFromSheet } from "../src/lib/google-sheets";
import { WORKERS } from "./workers.local";

const prisma = new PrismaClient();

async function main() {
  const handle = process.argv[2]?.trim().toLowerCase();
  if (!handle) {
    console.error("Uso: npm run sheets:clear-user -- <handle>");
    console.error("Es.: npm run sheets:clear-user -- rocco");
    process.exit(1);
  }

  const worker = WORKERS.find((w) => w.handle === handle);
  const user = await prisma.user.findUnique({ where: { handle } });
  if (!user) {
    console.error(`Utente "${handle}" non trovato nel DB.`);
    process.exit(1);
  }

  const result = await deleteUserRowsFromSheet({
    email: user.email ?? worker?.email,
    displayName: user.displayName,
  });

  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }

  console.log(
    `✓ Google Sheets — rimosse ${result.deleted} righe per ${user.displayName} (${user.email ?? "—"})`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
