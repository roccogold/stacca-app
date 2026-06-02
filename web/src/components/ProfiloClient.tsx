"use client";

import { useEffect, useState } from "react";
import { Check, LogOut, MessageSquare, Wifi } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { BottomSheet } from "@/components/BottomSheet";
import { logoutAction } from "@/app/(main)/actions";

type Props = {
  firstName: string;
};

export function ProfiloClient({ firstName }: Props) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  async function sendFeedback() {
    if (!feedback.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: feedback.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Errore nell'invio");
        return;
      }
      setSent(true);
      setTimeout(() => {
        setFeedback("");
        setSent(false);
        setFeedbackOpen(false);
      }, 1400);
    } catch {
      setError("Connessione assente. Riprova.");
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
            onClick={() => {
              setError(null);
              setFeedbackOpen(true);
            }}
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
              <div className="account-row__title">Connessione</div>
              <div className="account-row__sub">{online ? "Online" : "Offline"}</div>
            </div>
            <span
              className={`sync-status__dot${online ? " sync-status__dot--online" : " sync-status__dot--offline"}`}
              role="status"
              aria-label={online ? "Online" : "Offline"}
            />
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
        subtitle="Il messaggio arriva a chi gestisce l'app."
      >
        <textarea
          className="textarea sheet__textarea"
          rows={5}
          placeholder="Cosa vuoi dire? Idee, bug, cose da migliorare…"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        {error && <p className="field-error">{error}</p>}
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

      <AppFooter />
    </>
  );
}
