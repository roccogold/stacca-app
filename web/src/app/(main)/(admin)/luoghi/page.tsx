import { OptionsManager } from "@/components/OptionsManager";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LuoghiPage() {
  await requireAdmin();

  const [rows, areas] = await Promise.all([
    prisma.luogo.findMany({ orderBy: { name: "asc" } }),
    prisma.area.findMany({ where: { archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const initial = rows.map((r) => ({ id: r.id, name: r.name, areaId: r.areaId }));

  return (
    <OptionsManager
      resource="luoghi"
      initial={initial}
      areas={areas}
      labels={{
        title: "Luoghi",
        newButton: "Nuovo luogo",
        createTitle: "Nuovo luogo",
        editTitle: "Rinomina luogo",
        nameLabel: "Nome",
        countOne: "luogo",
        countMany: "luoghi",
      }}
    />
  );
}
