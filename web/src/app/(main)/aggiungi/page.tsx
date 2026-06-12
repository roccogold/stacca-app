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

  // Solo le aree del dipendente, ciascuna con lavorazioni e luoghi attivi.
  const areaRows = await prisma.area.findMany({
    where: { archived: false, users: { some: { userId: user.id } } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      lavorazioni: {
        where: { archived: false },
        orderBy: { name: "asc" },
        select: { name: true },
      },
      luoghi: {
        where: { archived: false },
        orderBy: { name: "asc" },
        select: { name: true },
      },
    },
  });
  const options = {
    areas: areaRows.map((a) => ({
      id: a.id,
      name: a.name,
      lavorazioni: a.lavorazioni.map((l) => l.name),
      luoghi: a.luoghi.map((l) => l.name),
    })),
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
