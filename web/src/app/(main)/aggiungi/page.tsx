import { AggiungiForm } from "@/components/AggiungiForm";
import { requireUser } from "@/lib/auth";
import {
  assertEntryDateAllowed,
  getEditableDateBoundsRome,
} from "@/lib/month-lock";
import { prisma } from "@/lib/prisma";
import { clampISODate, todayISO } from "@/lib/format";
import { isLocalEntryId } from "@/lib/offline-queue";

export default async function AggiungiPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; date?: string }>;
}) {
  const user = await requireUser();
  const { edit, date } = await searchParams;

  const editLocalId = edit && isLocalEntryId(edit) ? edit : null;
  const initial =
    edit && !isLocalEntryId(edit)
      ? await prisma.timeEntry.findFirst({
          where: { id: edit, userId: user.id },
        })
      : null;

  const presetDate =
    !edit && date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;

  const bounds = await getEditableDateBoundsRome(user.id);
  const rawDate = initial?.date ?? presetDate ?? todayISO();
  const targetDate = clampISODate(rawDate, bounds.min, bounds.max);
  const allowed = await assertEntryDateAllowed(user.id, targetDate);
  const locked = !allowed.ok;

  const [mansioniRows, luoghiRows] = await Promise.all([
    prisma.lavorazione.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    prisma.luogo.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
      select: { name: true, category: true },
    }),
  ]);
  const options = {
    mansioni: mansioniRows.map((r) => r.name),
    luoghiVigne: luoghiRows.filter((r) => r.category === "vigne").map((r) => r.name),
    luoghiAltro: luoghiRows.filter((r) => r.category === "altro").map((r) => r.name),
  };

  return (
    <AggiungiForm
      initial={initial}
      editLocalId={editLocalId}
      presetDate={targetDate}
      locked={locked}
      minDate={bounds.min}
      maxDate={bounds.max}
      options={options}
    />
  );
}
