"use client";

import { ArrowUp, Bot } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
          <span className="analisi-chat__icon" aria-hidden>
            <Bot size={18} />
          </span>
          <span className="analisi-chat__title">Staccai</span>
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
