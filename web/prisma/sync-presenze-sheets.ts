/**
 * Backfill tab "Presenze [Nome]" for every worker with at least one month submission.
 * Run: npm run sheets:sync-presenze
 */
import { syncEmployeePresenzeTab } from "../src/lib/sync-presenze-sheet";
import { prisma } from "../src/lib/prisma";

async function main() {
  const userIds = await prisma.monthSubmission.findMany({
    select: { userId: true },
    distinct: ["userId"],
  });

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
