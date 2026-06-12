/**
 * Migrazione dati per la feature Aree. Idempotente, eseguibile in sicurezza
 * dopo `prisma migrate deploy` e prima del deploy del codice.
 *
 * - Crea le aree starter Vigna e Cantina.
 * - Assegna luoghi/lavorazioni esistenti (senza area) a un'area.
 * - Assegna i dipendenti esistenti a Vigna + Cantina (così vedono le stesse
 *   opzioni di oggi).
 * - Backfilla l'area sulle voci storiche.
 *
 *   npm run db:seed:areas
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const vigna = await prisma.area.upsert({
    where: { name: "Vigna" },
    create: { name: "Vigna" },
    update: {},
  });
  const cantina = await prisma.area.upsert({
    where: { name: "Cantina" },
    create: { name: "Cantina" },
    update: {},
  });
  console.log("✓ Aree: Vigna, Cantina");

  // Luoghi senza area → per category (legacy)
  const luoghiVigne = await prisma.luogo.updateMany({
    where: { areaId: null, category: "vigne" },
    data: { areaId: vigna.id },
  });
  const luoghiAltro = await prisma.luogo.updateMany({
    where: { areaId: null, NOT: { category: "vigne" } },
    data: { areaId: cantina.id },
  });
  console.log(`✓ Luoghi: ${luoghiVigne.count} → Vigna, ${luoghiAltro.count} → Cantina`);

  // Lavorazioni senza area → Vigna
  const lav = await prisma.lavorazione.updateMany({
    where: { areaId: null },
    data: { areaId: vigna.id },
  });
  console.log(`✓ Lavorazioni: ${lav.count} → Vigna`);

  // Dipendenti esistenti → Vigna + Cantina
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) {
    for (const areaId of [vigna.id, cantina.id]) {
      await prisma.userArea.upsert({
        where: { userId_areaId: { userId: u.id, areaId } },
        create: { userId: u.id, areaId },
        update: {},
      });
    }
  }
  console.log(`✓ Dipendenti: ${users.length} → Vigna + Cantina`);

  // Voci storiche senza area → "Vigna"
  const entries = await prisma.timeEntry.updateMany({
    where: { area: "" },
    data: { area: "Vigna" },
  });
  console.log(`✓ Voci storiche: ${entries.count} → area "Vigna"`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
