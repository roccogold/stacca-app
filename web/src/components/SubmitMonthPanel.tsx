"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Info } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { formatHoursIt } from "@/lib/format";

type Props = {
  month: string;
  monthLabel: string;
  monthTotal: number;
  hasEntries: boolean;
  canSubmit: boolean;
  submitted: boolean;
  submittedAt: string | null;
};

export function SubmitMonthPanel({
  month,
  monthLabel,
  monthTotal,
  hasEntries,
  canSubmit,
  submitted,
  submittedAt,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasEntries) return null;

  if (submitted) {
    return (
      <section className="block">
        <div className="callout callout--muted">
          <Info size={16} className="callout__icon" aria-hidden />
          <span>
            Mese inviato
            {submittedAt ? ` il ${submittedAt}` : ""}. Sola lettura.
          </span>
        </div>
      </section>
    );
  }

  async function submitMonth() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/month/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Errore nell'invio");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

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
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        title="Inviare il mese?"
      >
        <p className="sheet__body">
          Stai per inviare <strong>{formatHoursIt(monthTotal)} ore</strong> di{" "}
          <span className="capitalize">{monthLabel}</span> su Google Sheets. Dopo
          l&apos;invio non potrai più modificare le voci.
        </p>
        {error && (
          <p className="login-form__error" role="alert">
            {error}
          </p>
        )}
        <div className="sheet__actions">
          <button
            type="button"
            className="btn btn--primary btn--block btn--sheet"
            disabled={loading}
            onClick={submitMonth}
          >
            {loading ? "Invio…" : "Sì, invia"}
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--block btn--sheet-secondary"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Annulla
          </button>
        </div>
      </BottomSheet>
    </section>
  );
}
