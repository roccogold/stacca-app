import { AnalisiClient } from "@/components/AnalisiClient";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AnalisiEntry, AnalisiUser } from "@/lib/analisi";

export const dynamic = "force-dynamic";

export default async function AnalisiPage() {
  await requireAdmin();

  // Dataset piccolo (una sola azienda): carico tutte le voci e aggrego
  // client-side per filtri istantanei. Se un giorno cresce, filtrare qui per
  // anno (where: { date: { startsWith: anno } }).
  const [entries, users] = await Promise.all([
    prisma.timeEntry.findMany({
      select: {
        date: true,
        hours: true,
        mansione: true,
        luogo: true,
        area: true,
        userId: true,
      },
    }),
    prisma.user.findMany({
      where: { archived: false },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
  ]);

  const initialEntries: AnalisiEntry[] = entries;
  const initialUsers: AnalisiUser[] = users;

  return <AnalisiClient entries={initialEntries} users={initialUsers} />;
}
