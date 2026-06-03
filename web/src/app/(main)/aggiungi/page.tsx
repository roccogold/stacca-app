import { AggiungiForm } from "@/components/AggiungiForm";
import { requireUser } from "@/lib/auth";
import {
  assertEntryDateAllowed,
  currentMonthDateBoundsRome,
  currentMonthLabelRome,
} from "@/lib/month-lock";
import { prisma } from "@/lib/prisma";
import { clampISODate, todayISO } from "@/lib/format";

export default async function AggiungiPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; date?: string }>;
}) {
  const user = await requireUser();
  const { edit, date } = await searchParams;

  const initial = edit
    ? await prisma.timeEntry.findFirst({
        where: { id: edit, userId: user.id },
      })
    : null;

  const presetDate =
    !edit && date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;

  const bounds = currentMonthDateBoundsRome();
  const rawDate = initial?.date ?? presetDate ?? todayISO();
  const targetDate = clampISODate(rawDate, bounds.min, bounds.max);
  const allowed = await assertEntryDateAllowed(user.id, targetDate);
  const locked = !allowed.ok;

  return (
    <AggiungiForm
      initial={initial}
      presetDate={targetDate}
      locked={locked}
      minDate={bounds.min}
      maxDate={bounds.max}
      monthLabel={currentMonthLabelRome()}
    />
  );
}
