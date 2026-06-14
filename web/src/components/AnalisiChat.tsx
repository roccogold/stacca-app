"use client";

import { ArrowUp, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AnalisiUser } from "@/lib/analisi";

type ChatMessage = { role: "user" | "assistant"; content: string };

function buildSuggestions(employees: AnalisiUser[]): string[] {
  const name = employees[0]?.displayName.split(" ")[0];
  return [
    "In che mese si lavora di più?",
    name ? `Quante ore ha fatto ${name} questo mese?` : "Quante ore sono state fatte questo mese?",
    "Qual è il settore più attivo quest'anno?",
  ];
}

export function AnalisiChat({ users }: { users: AnalisiUser[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const suggestions = buildSuggestions(users);

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
            <Sparkles size={16} />
          </span>
          <span className="analisi-chat__title">Assistente Analisi</span>
          <span className="analisi-chat__badge">AI</span>
        </div>

        {isEmpty ? (
          <p className="analisi-chat__intro">
            Fai una domanda sui dati delle ore: ti rispondo con numeri esatti.
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
            <ArrowUp size={18} />
          </button>
        </form>
      </div>
    </section>
  );
}
