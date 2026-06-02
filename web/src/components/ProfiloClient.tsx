"use client";

import { useState } from "react";
import { Check, LogOut, MessageSquare, Wifi } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { logoutAction } from "@/app/(main)/actions";

type Props = {
  firstName: string;
};

export function ProfiloClient({ firstName }: Props) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function sendFeedback() {
    if (!feedback.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: feedback.trim() }),
      });
      if (!res.ok) return;
      setSent(true);
      setTimeout(() => {
        setFeedback("");
        setSent(false);
        setFeedbackOpen(false);
      }, 1400);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="page-header page-header--loose">
        <h1 className="h1">Ciao, {firstName}</h1>
      </header>

      <section className="block">
        <h2 className="section-title section-title--inset">Account</h2>
        <div className="card account-card">
          <button
            type="button"
            className="account-row account-row--btn"
            onClick={() => setFeedbackOpen(true)}
          >
            <MessageSquare size={20} className="account-row__icon" aria-hidden />
            <div className="account-row__body">
              <div className="account-row__title">Invia feedback</div>
              <div className="account-row__sub">Scrivi all&apos;admin</div>
            </div>
          </button>
          <div className="account-row">
            <Wifi size={20} className="account-row__icon account-row__icon--olive" aria-hidden />
            <div className="account-row__body">
              <div className="account-row__title">Sincronizzazione</div>
              <div className="account-row__sub">Online</div>
            </div>
            <span className="badge badge--ok">OK</span>
          </div>
        </div>
      </section>

      <section className="block block--spaced">
        <form action={logoutAction}>
          <button className="btn btn--logout btn--block" type="submit">
            <LogOut size={18} aria-hidden />
            Esci
          </button>
        </form>
      </section>

      <BottomSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        title="Invia feedback"
        subtitle="Cosa vuoi dire all'admin?"
      >
        <textarea
          className="textarea sheet__textarea"
          rows={5}
          placeholder="Scrivi qui…"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <div className="sheet__actions">
          <button
            type="button"
            className="btn btn--primary btn--block btn--sheet"
            onClick={sendFeedback}
            disabled={!feedback.trim() || loading || sent}
          >
            {sent ? (
              <>
                <Check size={20} aria-hidden /> Inviato
              </>
            ) : (
              "Invia"
            )}
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--block btn--sheet-secondary"
            onClick={() => setFeedbackOpen(false)}
          >
            Annulla
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
