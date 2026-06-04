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
  pending?: boolean;
};

export function EntryCardLink({
  href,
  hours,
  mansione,
  luogo,
  compact,
  readOnly,
  pending = false,
}: Props) {
  const content = (
    <>
      <div className="entry-card__body">
        <span className="entry-card__title">{mansione}</span>
        <span className="entry-card__meta">{luogo}</span>
        {pending && <span className="entry-card__pending">In attesa</span>}
      </div>
      <div className="entry-card__aside">
        <span className="entry-card__hours">{formatHoursIt(hours)}</span>
        {!readOnly && (
          <ChevronRight size={20} className="entry-card__chev" aria-hidden />
        )}
      </div>
    </>
  );

  if (readOnly || !href) {
    return (
      <div
        className={`entry-card entry-card--readonly${pending ? " entry-card--pending" : ""}${compact ? " entry-card--compact" : ""}`}
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      prefetch
      className={`entry-card${pending ? " entry-card--pending" : ""}${compact ? " entry-card--compact" : ""}`}
    >
      {content}
    </Link>
  );
}
