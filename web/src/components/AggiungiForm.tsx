"use client";

import type { TimeEntry } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition, useState } from "react";
import {
  HOUR_CHIPS,
  LUOGHI_ALTRO,
  LUOGHI_VIGNE,
  MANSIONI,
} from "@/lib/constants";
import { formatHoursIt, stepHours, todayISO } from "@/lib/format";

type Props = {
  initial: TimeEntry | null;
  presetDate?: string;
  locked?: boolean;
};

function clampStep(h: number, delta: number): number {
  return stepHours(h, delta);
}

export function AggiungiForm({ initial, presetDate, locked = false }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const editId = initial?.id ?? null;
  const [date, setDate] = useState(initial?.date ?? presetDate ?? todayISO());
  const [hours, setHours] = useState(initial?.hours ?? 0);
  const [mansione, setMansione] = useState(initial?.mansione ?? "");
  const [luogo, setLuogo] = useState(initial?.luogo ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  function goHome() {
    document.dispatchEvent(new Event("stacca:navigate"));
    startTransition(() => {
      router.replace("/");
    });
    void router.refresh();
  }

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
        setLoading(false);
        return;
      }
      goHome();
      return;
    } catch {
      setError("Errore nel salvataggio");
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
        setLoading(false);
        return;
      }
      goHome();
    } catch {
      setError("Errore");
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
          {locked ? "Voce (sola lettura)" : editId ? "Modifica voce" : "Aggiungi ore"}
        </h1>
      </header>

      <main className="form-body">
        {locked && (
          <p className="form-hint">Mese già inviato — non puoi modificare questa voce.</p>
        )}
        {!editId && !locked && (
          <p className="form-hint">
            Puoi salvare più voci per lo stesso giorno — una per ogni lavorazione e luogo.
          </p>
        )}
        <div className="field">
          <label className="field-label field-label--plain" htmlFor="data">
            Data
          </label>
          <div className="field-control">
            <input className="input input--lg" id="data" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={locked} />
          </div>
        </div>

        <div className="field">
          <span className="field-label field-label--plain">Ore</span>
          <div className="stepper-card">
            <div className="stepper">
              <button type="button" className="stepper__btn" aria-label="Diminuisci" onClick={() => setHours((h) => clampStep(h, -0.25))} disabled={locked || loading}>
                −
              </button>
              <div className="stepper__value">
                <span className="stepper__num">{formatHoursIt(hours)}</span>
                <span className="stepper__unit">ore</span>
              </div>
              <button type="button" className="stepper__btn" aria-label="Aumenta" onClick={() => setHours((h) => clampStep(h, 0.25))} disabled={locked || loading}>
                +
              </button>
            </div>
            <p className="form-hint form-hint--tight">Usa +/− per i quarti d&apos;ora</p>
            <div className="chips chips--pills">
              {HOUR_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`chip chip--pill${Math.abs(hours - c) < 0.001 ? " chip--active" : ""}`}
                  onClick={() => setHours(c)}
                  disabled={locked}
                  aria-label={`${formatHoursIt(c)} ore`}
                >
                  {formatHoursIt(c)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="field">
          <label className="field-label field-label--plain" htmlFor="lavorazione">
            Lavorazione
          </label>
          <div className="field-control">
            <select className="select select--lg" id="lavorazione" value={mansione} onChange={(e) => setMansione(e.target.value)} required disabled={locked}>
              <option value="" disabled hidden />
              {MANSIONI.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field-label field-label--plain" htmlFor="luogo">
            Luogo
          </label>
          <div className="field-control">
            <select className="select select--lg" id="luogo" value={luogo} onChange={(e) => setLuogo(e.target.value)} required disabled={locked}>
              <option value="" disabled hidden />
              <optgroup label="Vigne">
                {LUOGHI_VIGNE.map((l) => (
                  <option key={`vigne-${l}`} value={l}>{l}</option>
                ))}
              </optgroup>
              <optgroup label="Altro">
                {LUOGHI_ALTRO.map((l) => (
                  <option key={`altro-${l}`} value={l}>{l}</option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field-label field-label--plain" htmlFor="note">
            Note (opzionale)
          </label>
          <div className="field-control">
            <textarea
              className="textarea"
              id="note"
              placeholder="Qualcosa da ricordare?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              disabled={locked}
            />
          </div>
        </div>

        {error && <p className="field-error">{error}</p>}

        {editId && !locked && (
          <button type="button" className="btn btn--danger-outline btn--block" onClick={remove} disabled={loading}>
            Elimina voce
          </button>
        )}
      </main>

      {!locked && (
      <div className="form-footer">
        <div className="form-footer__inner">
          <button
            type="button"
            className="btn btn--primary btn--block btn--sheet"
            onClick={save}
            disabled={loading || hours <= 0 || !mansione || !luogo}
          >
            {loading ? "Salvataggio…" : editId ? "Aggiorna voce" : "Salva voce"}
          </button>
        </div>
      </div>
      )}
    </>
  );
}
