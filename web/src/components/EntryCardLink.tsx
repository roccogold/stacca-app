import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatHoursIt } from "@/lib/format";

type Props = {
  href?: string;
  hours: number;
  mansione: string;
  luogo: string;
  compact?: boolean;
  readOnly?: boolean;
};

export function EntryCardLink({
  href,
  hours,
  mansione,
  luogo,
  compact,
  readOnly,
}: Props) {
  const content = (
    <>
      <div className="entry-card__body">
        <div className="entry-card__row">
          <span className="entry-card__title">{mansione}</span>
          <span className="entry-card__hours">{formatHoursIt(hours)}</span>
        </div>
        <span className="entry-card__meta">{luogo}</span>
      </div>
      {!readOnly && (
        <ChevronRight size={20} className="entry-card__chev" aria-hidden />
      )}
    </>
  );

  if (readOnly || !href) {
    return (
      <div
        className={`entry-card entry-card--readonly${compact ? " entry-card--compact" : ""}`}
      >
        {content}
      </div>
    );
  }

  return (
    <Link href={href} prefetch className={`entry-card${compact ? " entry-card--compact" : ""}`}>
      {content}
    </Link>
  );
}
