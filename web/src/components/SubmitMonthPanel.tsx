"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { formatHoursIt } from "@/lib/format";

type Props = {
  monthLabel: string;
  monthTotal: number;
  hasEntries: boolean;
  canSubmit: boolean;
};

export function SubmitMonthPanel({
  monthLabel,
  monthTotal,
  hasEntries,
  canSubmit,
}: Props) {
  const [open, setOpen] = useState(false);

  if (!hasEntries) return null;

  return (
    <section className="block">
      <div className="callout callout--accent">
        <Info size={16} className="callout__icon" aria-hidden />
        <span>Invia solo a fine mese. Dopo l&apos;invio non potrai più modificare.</span>
      </div>
      <button
        type="button"
        className="btn btn--primary btn--block btn--sheet"
        disabled={!canSubmit}
        onClick={() => setOpen(true)}
      >
        Invia mese
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Inviare il mese?"
      >
        <p className="sheet__body">
          Stai per inviare <strong>{formatHoursIt(monthTotal)} ore</strong> di{" "}
          <span className="capitalize">{monthLabel}</span>. Dopo l&apos;invio non potrai più
          modificare le voci.
        </p>
        <div className="sheet__actions">
          <button
            type="button"
            className="btn btn--primary btn--block btn--sheet"
            disabled
            title="Prossimamente — sync Google Sheets"
          >
            Sì, invia
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--block btn--sheet-secondary"
            onClick={() => setOpen(false)}
          >
            Annulla
          </button>
        </div>
      </BottomSheet>
    </section>
  );
}
