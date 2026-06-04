"use client";

import type { TimeEntry } from "@prisma/client";
import { ArrowLeft, Calendar } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition, useState } from "react";
import { HoursEntryCard } from "@/components/HoursEntryCard";
import { useOfflineSync } from "@/components/OfflineSyncProvider";
import { LUOGHI_ALTRO, LUOGHI_VIGNE, MANSIONI } from "@/lib/constants";
import { clampISODate, formatDateField, todayISO } from "@/lib/format";
import {
  getPendingEntryByLocalId,
  isLocalEntryId,
  parseLocalEntryId,
} from "@/lib/offline-queue";

type Props = {
  initial: TimeEntry | null;
  editLocalId?: string | null;
  presetDate?: string;
  locked?: boolean;
  minDate: string;
  maxDate: string;
  monthLabel: string;
};

function initialHoursValue(existing: number | undefined): number {
  if (existing != null && existing > 0) return existing;
  return 0;
}

export function AggiungiForm({
  initial,
  editLocalId = null,
  presetDate,
  locked = false,
  minDate,
  maxDate,
  monthLabel,
}: Props) {
  const router = useRouter();
  const { userId, saveEntry, deleteEntry } = useOfflineSync();
  const [, startTransition] = useTransition();
  const editId = initial?.id ?? editLocalId ?? null;
  const defaultDate = clampISODate(
    initial?.date ?? presetDate ?? todayISO(),
    minDate,
    maxDate,
  );
  const [date, setDate] = useState(defaultDate);
  const [hours, setHours] = useState(() => initialHoursValue(initial?.hours));
  const [mansione, setMansione] = useState(initial?.mansione ?? "");
  const [luogo, setLuogo] = useState(initial?.luogo ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingLoaded, setPendingLoaded] = useState(!editLocalId);

  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  useEffect(() => {
    if (!editLocalId || initial) return;
    let cancelled = false;
    void (async () => {
      const row = await getPendingEntryByLocalId(userId, editLocalId);
      if (cancelled || !row) {
        if (!cancelled) setError("Lavoro non trovato sul telefono");
        setPendingLoaded(true);
        return;
      }
      setDate(clampISODate(row.date, minDate, maxDate));
      setHours(row.hours);
      setMansione(row.mansione);
      setLuogo(row.luogo);
      setNote(row.note ?? "");
      setPendingLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [editLocalId, initial, minDate, maxDate, userId]);

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
      const localId = editId && isLocalEntryId(editId) ? editId : null;
      const serverId =
        initial?.id ?? (editId && !isLocalEntryId(editId) ? editId : null);
      const clientId = localId ? parseLocalEntryId(localId) : null;

      await saveEntry({
        serverId,
        clientId,
        payload,
      });
      goHome();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nel salvataggio");
      setLoading(false);
    }
  }

  async function remove() {
    if (!editId || !confirm("Vuoi davvero eliminare questo lavoro?")) return;
    setLoading(true);
    try {
      const localId = isLocalEntryId(editId) ? editId : null;
      const serverId = initial?.id ?? (localId ? null : editId);
      const clientId = localId ? parseLocalEntryId(localId) : null;
      await deleteEntry({ serverId, clientId });
      goHome();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
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
          {locked ? "Lavoro (sola lettura)" : editId ? "Modifica lavoro" : "Aggiungi ore"}
        </h1>
      </header>

      <main className="form-body">
        {locked && (
          <p className="form-hint">Mese già inviato — non puoi modificare questo lavoro.</p>
        )}
        {!editId && !locked && (
          <p className="form-hint">
            Stai registrando <span className="capitalize">{monthLabel}</span>. Stesso giorno con
            lavori diversi? Aggiungi un altro lavoro se cambi lavorazione o luogo.
          </p>
        )}
        <div className="field">
          <label className="field-label field-label--plain" htmlFor="data">
            Data
          </label>
          <div className={`date-card${locked ? " date-card--disabled" : ""}`}>
            <span className="date-card__value">{formatDateField(date)}</span>
            <Calendar size={20} className="date-card__icon" aria-hidden />
            <input
              className="date-card__input"
              id="data"
              type="date"
              value={date}
              min={minDate}
              max={maxDate}
              onChange={(e) =>
                setDate(clampISODate(e.target.value, minDate, maxDate))
              }
              disabled={locked}
              aria-label="Data"
            />
          </div>
        </div>

        <HoursEntryCard
          hours={hours}
          onHoursChange={setHours}
          disabled={locked || loading}
          initialHours={initial?.hours}
        />

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
            Elimina lavoro
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
            disabled={loading || !pendingLoaded || hours <= 0 || !mansione || !luogo}
          >
            {loading ? "Salvataggio…" : editId ? "Aggiorna lavoro" : "Salva lavoro"}
          </button>
        </div>
      </div>
      )}
    </>
  );
}
