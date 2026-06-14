"use client";

import { ArrowUp, Bot } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ANALISI_CHAT_MODEL_LABEL } from "@/lib/analisi-chat";

/** Simbolo ufficiale Claude (starburst Anthropic), da anthropic.com / Wikimedia CC0. */
function ClaudeMark({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="hsl(14.8, 63.1%, 59.6%)"
      aria-hidden
    >
      <path d="m19.6 66.5 19.7-11 .3-1-.3-.5h-1l-3.3-.2-11.2-.3L14 53l-9.5-.5-2.4-.5L0 49l.2-1.5 2-1.3 2.9.2 6.3.5 9.5.6 6.9.4L38 49.1h1.6l.2-.7-.5-.4-.4-.4L29 41l-10.6-7-5.6-4.1-3-2-1.5-2-.6-4.2 2.7-3 3.7.3.9.2 3.7 2.9 8 6.1L37 36l1.5 1.2.6-.4.1-.3-.7-1.1L33 25l-6-10.4-2.7-4.3-.7-2.6c-.3-1-.4-2-.4-3l3-4.2L28 0l4.2.6L33.8 2l2.6 6 4.1 9.3L47 29.9l2 3.8 1 3.4.3 1h.7v-.5l.5-7.2 1-8.7 1-11.2.3-3.2 1.6-3.8 3-2L61 2.6l2 2.9-.3 1.8-1.1 7.7L59 27.1l-1.5 8.2h.9l1-1.1 4.1-5.4 6.9-8.6 3-3.5L77 13l2.3-1.8h4.3l3.1 4.7-1.4 4.9-4.4 5.6-3.7 4.7-5.3 7.1-3.2 5.7.3.4h.7l12-2.6 6.4-1.1 7.6-1.3 3.5 1.6.4 1.6-1.4 3.4-8.2 2-9.6 2-14.3 3.3-.2.1.2.3 6.4.6 2.8.2h6.8l12.6 1 3.3 2 1.9 2.7-.3 2-5.1 2.6-6.8-1.6-16-3.8-5.4-1.3h-.8v.4l4.6 4.5 8.3 7.5L89 80.1l.5 2.4-1.3 2-1.4-.2-9.2-7-3.6-3-8-6.8h-.5v.7l1.8 2.7 9.8 14.7.5 4.5-.7 1.4-2.6 1-2.7-.6-5.8-8-6-9-4.7-8.2-.5.4-2.9 30.2-1.3 1.5-3 1.2-2.5-2-1.4-3 1.4-6.2 1.6-8 1.3-6.4 1.2-7.9.7-2.6v-.2H49L43 72l-9 12.3-7.2 7.6-1.7.7-3-1.5.3-2.8L24 86l10-12.8 6-7.9 4-4.6-.1-.5h-.3L17.2 77.4l-4.7.6-2-2 .2-3 1-1 8-5.5Z" />
    </svg>
  );
}

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "In quale luogo si è lavorato di più quest'anno?",
  "Quali sono le 3 lavorazioni principali questo mese?",
];

export function AnalisiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const suggestions = SUGGESTIONS;

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    setError(null);
    setInput("");
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch("/api/analisi/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Errore dell'assistente. Riprova.");
        return;
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", content: String(data.reply ?? "") },
      ]);
    } catch {
      setError("Connessione non riuscita. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <section className="block">
      <div className="card analisi-chat">
        <div className="analisi-chat__head">
          <span className="analisi-chat__brand">
            <span className="analisi-chat__icon" aria-hidden>
              <Bot size={18} />
            </span>
            <span className="analisi-chat__title">Staccai</span>
          </span>
          <span className="analisi-chat__model" title={ANALISI_CHAT_MODEL_LABEL}>
            <ClaudeMark size={14} />
            {ANALISI_CHAT_MODEL_LABEL}
          </span>
        </div>

        {isEmpty ? (
          <p className="analisi-chat__intro">
            Fai una domanda sui dati delle ore, ti rispondo con numeri esatti.
          </p>
        ) : (
          <div className="analisi-chat__log" ref={scrollRef}>
            {messages.map((m, i) => (
              <div
                key={i}
                className={`analisi-chat__bubble analisi-chat__bubble--${m.role}`}
              >
                {m.content}
              </div>
            ))}
            {loading ? (
              <div className="analisi-chat__bubble analisi-chat__bubble--assistant analisi-chat__bubble--typing">
                <span className="analisi-chat__dot" />
                <span className="analisi-chat__dot" />
                <span className="analisi-chat__dot" />
              </div>
            ) : null}
          </div>
        )}

        {error ? <p className="analisi-chat__error">{error}</p> : null}

        {isEmpty ? (
          <div className="analisi-chat__chips">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="analisi-chat__chip"
                onClick={() => send(s)}
                disabled={loading}
              >
                {s}
              </button>
            ))}
          </div>
        ) : null}

        <form
          className="analisi-chat__form"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            className="input analisi-chat__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Chiedi qualcosa sui dati..."
            aria-label="Domanda per l'assistente"
            disabled={loading}
            maxLength={1000}
          />
          <button
            type="submit"
            className="analisi-chat__send"
            aria-label="Invia"
            disabled={loading || !input.trim()}
          >
            <ArrowUp size={16} />
          </button>
        </form>
      </div>
    </section>
  );
}
