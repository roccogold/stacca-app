import { AggiungiForm } from "@/components/AggiungiForm";
import { requireUser } from "@/lib/auth";
import { isMonthLocked, monthFromDate } from "@/lib/month-lock";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/format";

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

  const targetDate = initial?.date ?? presetDate ?? todayISO();
  const locked = await isMonthLocked(user.id, monthFromDate(targetDate));

  return (
    <AggiungiForm initial={initial} presetDate={presetDate} locked={locked} />
  );
}
