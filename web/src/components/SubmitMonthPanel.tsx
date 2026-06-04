"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Info } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { MonthSubmitCelebration } from "@/components/MonthSubmitCelebration";
import { useOfflineSync } from "@/components/OfflineSyncProvider";
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
  const { pendingCount, online } = useOfflineSync();
  const [open, setOpen] = useState(false);
  const blockSubmit = pendingCount > 0 || !online;
  const [celebrate, setCelebrate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasEntries) return null;

  if (submitted) {
    return (
      <section className="block">
        <div className="callout callout--muted">
          <Info size={16} className="callout__icon" aria-hidden />
          <span>
            Grazie, mese inviato
            {submittedAt ? ` il ${submittedAt}` : ""} — sola lettura.
          </span>
        </div>
      </section>
    );
  }

  async function submitMonth() {
    if (blockSubmit) {
      setError(
        pendingCount > 0
          ? "Invia prima i lavori in sospeso dal telefono."
          : "Serve connessione per inviare il mese.",
      );
      return;
    }
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
      setCelebrate(true);
    } finally {
      setLoading(false);
    }
  }

  function closeCelebration() {
    setCelebrate(false);
    router.refresh();
  }

  return (
    <section className="block">
      <div className="callout callout--accent">
        <Info size={16} className="callout__icon" aria-hidden />
        <span>
          Invia solo a fine mese, dopo l&apos;invio non potrai più modificare le ore.
        </span>
      </div>
      {blockSubmit && (
        <p className="form-hint" style={{ marginBottom: 12 }}>
          {pendingCount > 0
            ? "Hai lavori salvati sul telefono: attendi l'invio automatico prima di chiudere il mese."
            : "Serve connessione per inviare il mese."}
        </p>
      )}
      <button
        type="button"
        className="btn btn--primary btn--block btn--sheet"
        disabled={!canSubmit || blockSubmit}
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
          Stai per inviare <strong>{formatHoursIt(monthTotal)}</strong> di{" "}
          {monthLabel}. Dopo l&apos;invio non potrai più modificare le ore.
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

      <MonthSubmitCelebration
        open={celebrate}
        monthLabel={monthLabel}
        monthTotal={monthTotal}
        onClose={closeCelebration}
      />
    </section>
  );
}
