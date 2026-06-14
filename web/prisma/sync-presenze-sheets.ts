/**
 * Backfill tab "Ore [Nome]" for every worker with at least one entry.
 * Run: npm run sheets:sync-presenze
 */
import { syncEmployeePresenzeTab } from "../src/lib/sync-presenze-sheet";
import { prisma } from "../src/lib/prisma";

async function main() {
  const userIds = await prisma.timeEntry.findMany({
    select: { userId: true },
    distinct: ["userId"],
  });

  if (userIds.length === 0) {
    console.log("Nessun lavoro in DB — nulla da sincronizzare.");
    return;
  }

  for (const { userId } of userIds) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    const res = await syncEmployeePresenzeTab(userId);
    if (!res.ok) {
      console.error(`FAIL ${user?.displayName ?? userId}: ${res.error}`);
      process.exitCode = 1;
      continue;
    }
    console.log(
      res.skipped
        ? `skip ${user?.displayName ?? userId}`
        : `ok ${user?.displayName ?? userId} → ${res.tab}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
