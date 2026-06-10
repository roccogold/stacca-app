import { OptionsManager } from "@/components/OptionsManager";
import { RESERVED_OPTION } from "@/lib/admin-options";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LavorazioniPage() {
  await requireAdmin();

  const rows = await prisma.lavorazione.findMany({ orderBy: { name: "asc" } });
  const initial = rows.map((r) => ({ id: r.id, name: r.name }));

  return (
    <OptionsManager
      resource="lavorazioni"
      initial={initial}
      reservedLabel={RESERVED_OPTION}
      labels={{
        title: "Lavorazioni",
        newButton: "Nuova lavorazione",
        createTitle: "Nuova lavorazione",
        editTitle: "Rinomina lavorazione",
        nameLabel: "Nome lavorazione",
        countOne: "lavorazione",
        countMany: "lavorazioni",
        deleteScope: "nelle nuove lavorazioni",
      }}
    />
  );
}
