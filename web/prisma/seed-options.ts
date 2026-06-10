/**
 * Idempotent seed for the admin-managed option lists (Lavorazione / Luogo).
 * Populates the tables from the historical hardcoded constants. Safe to re-run:
 * `upsert` with an empty `update` never clobbers admin edits (renames/archives).
 * The reserved catch-all "Altro" is intentionally NOT inserted.
 *
 *   npm run db:seed:options
 */
import { PrismaClient } from "@prisma/client";
import { LUOGHI_ALTRO, LUOGHI_VIGNE, MANSIONI } from "../src/lib/constants";
import { RESERVED_OPTION } from "../src/lib/admin-options";

const prisma = new PrismaClient();

const isReserved = (name: string) =>
  name.trim().toLowerCase() === RESERVED_OPTION.toLowerCase();

async function main() {
  const mansioni = MANSIONI.filter((n) => !isReserved(n));
  for (const name of mansioni) {
    await prisma.lavorazione.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }
  console.log(`✓ Lavorazioni: ${mansioni.length} voci verificate`);

  const luoghi: Array<{ name: string; category: "vigne" | "altro" }> = [
    ...LUOGHI_VIGNE.filter((n) => !isReserved(n)).map((name) => ({
      name,
      category: "vigne" as const,
    })),
    ...LUOGHI_ALTRO.filter((n) => !isReserved(n)).map((name) => ({
      name,
      category: "altro" as const,
    })),
  ];
  for (const { name, category } of luoghi) {
    await prisma.luogo.upsert({
      where: { name },
      create: { name, category },
      update: {},
    });
  }
  console.log(`✓ Luoghi: ${luoghi.length} voci verificate`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
