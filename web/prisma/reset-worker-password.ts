import { PrismaClient } from "@prisma/client";
import { demoPasswordForHandle, hashSecret } from "../src/lib/password";
import { WORKERS } from "./workers.local";

const prisma = new PrismaClient();

async function main() {
  const handle = process.argv[2]?.trim().toLowerCase();
  if (!handle) {
    console.error("Uso: npm run db:reset-password -- <handle>");
    console.error("Es.: npm run db:reset-password -- arianna");
    process.exit(1);
  }

  const worker = WORKERS.find((w) => w.handle === handle);
  if (!worker) {
    console.error(`Handle "${handle}" non trovato in workers.local.ts`);
    process.exit(1);
  }

  const password = demoPasswordForHandle(worker.handle, worker.suffix);
  const passwordHash = await hashSecret(password);

  const user = await prisma.user.findUnique({ where: { handle } });
  if (!user) {
    console.error(`Utente "${handle}" non esiste nel DB. Esegui npm run db:seed`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { handle },
    data: {
      passwordHash,
      mustChangePassword: true,
      resetCodeHash: null,
      resetCodeExpiresAt: null,
    },
  });

  const name = `${worker.firstName} ${worker.lastName}`.trim();
  console.log(`✓ ${name} — password resettata — demo: ${password}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
