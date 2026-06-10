import { OptionsManager } from "@/components/OptionsManager";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LuoghiPage() {
  await requireAdmin();

  const rows = await prisma.luogo.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  const initial = rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category as "vigne" | "altro",
  }));

  return (
    <OptionsManager
      resource="luoghi"
      initial={initial}
      withCategory
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
