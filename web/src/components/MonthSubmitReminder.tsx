import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import type { MonthSubmitReminder as Reminder } from "@/lib/month-reminder";

type Props = {
  reminder: Reminder;
};

export function MonthSubmitReminder({ reminder }: Props) {
  const title = `Ricordati di inviare il mese di ${reminder.monthLabel}`;

  return (
    <Link href={reminder.href} className="month-reminder" prefetch>
      <span className="month-reminder__icon" aria-hidden>
        <Bell size={20} strokeWidth={2} />
      </span>
      <span className="month-reminder__text">
        <span className="month-reminder__title">{title}</span>
      </span>
      <ChevronRight size={20} className="month-reminder__chevron" aria-hidden />
    </Link>
  );
}
