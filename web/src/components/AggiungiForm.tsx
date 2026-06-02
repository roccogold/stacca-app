"use client";

import type { TimeEntry } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  HOUR_CHIPS,
  LUOGHI_ALTRO,
  LUOGHI_VIGNE,
  MANSIONI,
} from "@/lib/constants";
import { formatHoursIt, todayISO } from "@/lib/format";

type Props = {
  initial: TimeEntry | null;
};

function clampStep(h: number, delta: number): number {
  const n = Math.round((h + delta) * 2) / 2;
  return Math.min(24, Math.max(0, n));
}

export function AggiungiForm({ initial }: Props) {
  const router = useRouter();
  const editId = initial?.id ?? null;
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [hours, setHours] = useState(initial?.hours ?? 8);
  const [mansione, setMansione] = useState(initial?.mansione ?? MANSIONI[0] ?? "");
  const [luogo, setLuogo] = useState(initial?.luogo ?? LUOGHI_VIGNE[0] ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    setError(null);
    setLoading(true);
    try {
      const payload = {
        date,
        hours,
        mansione,
        luogo,
        note: note.trim() || null,
      };
      const url = editId ? `/api/entries/${editId}` : "/api/entries";
      const res = await fetch(url, {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Errore nel salvataggio");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!editId || !confirm("Vuoi davvero eliminare questa voce?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/entries/${editId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Errore");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="form-header">
        <Link href="/" className="cal-nav__btn" aria-label="Indietro">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="form-header__title">
          {editId ? "Modifica voce" : "Aggiungi ore"}
        </h1>
      </header>

      <main className="form-body">
        <div className="field">
          <label className="field-label field-label--plain" htmlFor="data">
            Data
          </label>
          <input className="input input--lg" id="data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="field">
          <span className="field-label field-label--plain">Ore</span>
          <div className="stepper-card">
            <div className="stepper">
              <button type="button" className="stepper__btn" aria-label="Diminuisci" onClick={() => setHours((h) => clampStep(h, -0.5))}>
                −
              </button>
              <div className="stepper__value">
                <span className="stepper__num">{formatHoursIt(hours)}</span>
                <span className="stepper__unit">ore</span>
              </div>
              <button type="button" className="stepper__btn" aria-label="Aumenta" onClick={() => setHours((h) => clampStep(h, 0.5))}>
                +
              </button>
            </div>
            <div className="chips chips--pills">
              {HOUR_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`chip chip--pill${hours === c ? " chip--active" : ""}`}
                  onClick={() => setHours(c)}
                >
                  {formatHoursIt(c)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="field">
          <label className="field-label field-label--plain" htmlFor="mansione">
            Mansione
          </label>
          <select className="select select--lg" id="mansione" value={mansione} onChange={(e) => setMansione(e.target.value)} required>
            {MANSIONI.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field-label field-label--plain" htmlFor="luogo">
            Luogo
          </label>
          <select className="select select--lg" id="luogo" value={luogo} onChange={(e) => setLuogo(e.target.value)} required>
            <optgroup label="Vigne">
              {LUOGHI_VIGNE.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </optgroup>
            <optgroup label="Altro">
              {LUOGHI_ALTRO.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="field">
          <label className="field-label field-label--plain" htmlFor="note">
            Note (opzionale)
          </label>
          <textarea
            className="textarea"
            id="note"
            placeholder="Qualcosa da ricordare?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
          />
        </div>

        {error && <p className="field-error">{error}</p>}

        {editId && (
          <button type="button" className="btn btn--danger-outline btn--block" onClick={remove} disabled={loading}>
            Elimina voce
          </button>
        )}
      </main>

      <div className="form-footer">
        <div className="form-footer__inner">
          <button
            type="button"
            className="btn btn--primary btn--block btn--sheet"
            onClick={save}
            disabled={loading || hours <= 0}
          >
            {loading ? "Salvataggio…" : editId ? "Aggiorna voce" : "Salva voce"}
          </button>
        </div>
      </div>
    </>
  );
}
