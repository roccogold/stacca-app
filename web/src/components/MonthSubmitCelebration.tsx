"use client";

import { Sparkles } from "lucide-react";
import { useEffect } from "react";
import { formatHoursIt } from "@/lib/format";

type Props = {
  open: boolean;
  monthLabel: string;
  monthTotal: number;
  onClose: () => void;
};

export function MonthSubmitCelebration({
  open,
  monthLabel,
  monthTotal,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="celebrate-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebrate-title"
      onClick={onClose}
    >
      <div
        className="celebrate-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="celebrate-card__icon" aria-hidden>
          <Sparkles size={28} strokeWidth={2} />
        </div>
        <h2 id="celebrate-title" className="celebrate-card__title">
          Ottimo mese!
        </h2>
        <p className="celebrate-card__body">
          <strong>{formatHoursIt(monthTotal)}</strong> a{" "}
          <span className="capitalize">{monthLabel}</span> inviate, grazie!
        </p>
        <button
          type="button"
          className="btn btn--primary btn--block celebrate-card__btn"
          onClick={onClose}
        >
          Chiudi
        </button>
      </div>
    </div>
  );
}
