import { OptionsManager } from "@/components/OptionsManager";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AreePage() {
  await requireAdmin();

  const rows = await prisma.area.findMany({ orderBy: { name: "asc" } });
  const initial = rows.map((r) => ({ id: r.id, name: r.name }));

  return (
    <OptionsManager
      resource="aree"
      initial={initial}
      labels={{
        title: "Settori",
        newButton: "Nuovo settore",
        createTitle: "Nuovo settore",
        editTitle: "Rinomina settore",
        nameLabel: "Nome",
        countOne: "settore",
        countMany: "settori",
      }}
    />
  );
}
