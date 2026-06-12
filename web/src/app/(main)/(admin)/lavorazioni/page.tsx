import { OptionsManager } from "@/components/OptionsManager";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LavorazioniPage() {
  await requireAdmin();

  const [rows, areas] = await Promise.all([
    prisma.lavorazione.findMany({ orderBy: { name: "asc" } }),
    prisma.area.findMany({ where: { archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const initial = rows.map((r) => ({ id: r.id, name: r.name, areaId: r.areaId }));

  return (
    <OptionsManager
      resource="lavorazioni"
      initial={initial}
      areas={areas}
      labels={{
        title: "Lavorazioni",
        newButton: "Nuova lavorazione",
        createTitle: "Nuova lavorazione",
        editTitle: "Rinomina lavorazione",
        nameLabel: "Nome",
        countOne: "lavorazione",
        countMany: "lavorazioni",
      }}
    />
  );
}
