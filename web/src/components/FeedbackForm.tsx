"use client";

import { useState } from "react";

export function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [errText, setErrText] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrText(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("err");
        setErrText(typeof data.error === "string" ? data.error : "Errore");
        return;
      }
      setStatus("ok");
      setMessage("");
    } catch {
      setStatus("err");
      setErrText("Rete non disponibile.");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="callout callout--info" style={{ marginBottom: 16 }}>
        Scrivi idee, bug o miglioramenti: arriva direttamente a chi gestisce Stacca (serve email configurata sul server).
      </div>
      {status === "ok" && (
        <p className="callout callout--info" style={{ color: "var(--secondary)", marginBottom: 12 }}>
          Inviato. Grazie!
        </p>
      )}
      {errText && <p className="field-error" style={{ marginBottom: 12 }}>{errText}</p>}
      <div className="field">
        <label className="field-label" htmlFor="fb-msg">
          Messaggio
        </label>
        <textarea
          id="fb-msg"
          className="textarea"
          rows={6}
          required
          minLength={3}
          maxLength={4000}
          placeholder="Es.: vorrei un promemoria alle 17…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
      <button className="btn btn--primary btn--block btn--lg" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Invio…" : "Invia feedback"}
      </button>
    </form>
  );
}
