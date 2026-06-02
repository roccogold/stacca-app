import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatHoursIt } from "@/lib/format";

type Props = {
  href: string;
  hours: number;
  mansione: string;
  luogo: string;
  compact?: boolean;
};

export function EntryCardLink({ href, hours, mansione, luogo, compact }: Props) {
  return (
    <Link href={href} className={`entry-card${compact ? " entry-card--compact" : ""}`}>
      <div className="entry-card__hours">
        <div className="entry-card__num">{formatHoursIt(hours)}</div>
        <div className="entry-card__unit">ore</div>
      </div>
      <div className="entry-card__body">
        <div className="entry-card__title">{mansione}</div>
        <div className="entry-card__meta">{luogo}</div>
      </div>
      <ChevronRight size={20} className="entry-card__chev" aria-hidden />
    </Link>
  );
}
