"use client";

import type { TimeEntry } from "@prisma/client";
import { ArrowLeft, Calendar, Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useTransition, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { HoursEntryCard } from "@/components/HoursEntryCard";
import { useOfflineSync } from "@/components/OfflineSyncProvider";
import {
  LUOGHI_ALTRO,
  LUOGHI_VIGNE,
  MANSIONI,
  MULTI_LUOGO_MANSIONE,
  MULTI_LUOGO_SEP,
  RESERVED_OPTION,
} from "@/lib/constants";
import {
  cacheOptions,
  readCachedOptions,
  type EntryOptions,
} from "@/lib/options-cache";
import {
  clampISODate,
  formatDateField,
  monthLabelFromDateISO,
  todayISO,
} from "@/lib/format";
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
  options?: EntryOptions;
};

const without = (list: readonly string[], name: string) =>
  list.filter((x) => x !== name);

/** Bundled lists minus the reserved catch-all — last-resort offline fallback. */
const FALLBACK_OPTIONS: EntryOptions = {
  mansioni: without(MANSIONI, RESERVED_OPTION),
  luoghiVigne: without(LUOGHI_VIGNE, RESERVED_OPTION),
  luoghiAltro: without(LUOGHI_ALTRO, RESERVED_OPTION),
};

function hasOptions(o: EntryOptions | undefined): o is EntryOptions {
  return !!o && o.mansioni.length > 0;
}

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
  options,
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

  // Option lists: server props → localStorage cache → bundled fallback.
  const [opts, setOpts] = useState<EntryOptions>(() =>
    hasOptions(options) ? options : FALLBACK_OPTIONS,
  );
  const optionsKey = hasOptions(options) ? JSON.stringify(options) : "";
  useEffect(() => {
    if (optionsKey) {
      // Online render: persist fresh lists for later offline use.
      cacheOptions(JSON.parse(optionsKey) as EntryOptions);
    } else {
      // No server props (served from cache offline): hydrate from the last
      // persisted lists. Reading localStorage isn't possible during SSR, so
      // this one-time sync from an external store belongs in an effect.
      const cached = readCachedOptions();
      if (cached && cached.mansioni.length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- external-store hydration on mount
        setOpts(cached);
      }
    }
  }, [optionsKey]);

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
      router.refresh();
    });
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
      setLoading(false);
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

  // Luogo multi-selezione: eccezione per "Trattore" (più vigne in una sessione).
  const isMultiLuogo = mansione === MULTI_LUOGO_MANSIONE;
  const [luogoPickerOpen, setLuogoPickerOpen] = useState(false);
  const selectedLuoghi = useMemo(
    () => (luogo ? luogo.split(MULTI_LUOGO_SEP).filter(Boolean) : []),
    [luogo],
  );
  const luogoOrder = useMemo(
    () => [...opts.luoghiVigne, ...opts.luoghiAltro, RESERVED_OPTION],
    [opts],
  );
  // Valori selezionati non più tra le opzioni attive (es. luogo archiviato).
  const extraLuoghi = selectedLuoghi.filter((n) => !luogoOrder.includes(n));

  function onMansioneChange(value: string) {
    setMansione(value);
    // Uscendo dalla multi-selezione con più luoghi, il singolo non può tenerli.
    if (value !== MULTI_LUOGO_MANSIONE && luogo.includes(MULTI_LUOGO_SEP)) {
      setLuogo("");
    }
  }

  function toggleLuogo(name: string) {
    const set = new Set(selectedLuoghi);
    if (set.has(name)) set.delete(name);
    else set.add(name);
    const ordered = luogoOrder.filter((n) => set.has(n));
    const extras = [...set].filter((n) => !luogoOrder.includes(n));
    setLuogo([...ordered, ...extras].join(MULTI_LUOGO_SEP));
  }

  const luogoSummary =
    selectedLuoghi.length === 0
      ? ""
      : selectedLuoghi.length === 1
        ? selectedLuoghi[0]
        : `${selectedLuoghi.length} luoghi`;

  const renderLuogoToggle = (name: string) => {
    const on = selectedLuoghi.includes(name);
    return (
      <button
        key={name}
        type="button"
        className={`luogo-opt${on ? " luogo-opt--on" : ""}`}
        onClick={() => toggleLuogo(name)}
        aria-pressed={on}
      >
        <span className="luogo-opt__name">{name}</span>
        <span className="luogo-opt__box" aria-hidden>
          {on ? <Check size={14} strokeWidth={3} /> : null}
        </span>
      </button>
    );
  };

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
            Puoi scegliere qualsiasi giorno in un mese ancora{" "}
            <strong>aperto</strong> (non inviato). Stai registrando{" "}
            <span className="capitalize">{monthLabelFromDateISO(date)}</span>. Stesso giorno con
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
            <select className="select select--lg" id="lavorazione" value={mansione} onChange={(e) => onMansioneChange(e.target.value)} required disabled={locked}>
              <option value="" disabled hidden />
              {opts.mansioni.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
              {mansione &&
                mansione !== RESERVED_OPTION &&
                !opts.mansioni.includes(mansione) && (
                  <option value={mansione}>{mansione}</option>
                )}
              <option value={RESERVED_OPTION}>{RESERVED_OPTION}</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field-label field-label--plain" htmlFor="luogo">
            Luogo
          </label>
          <div className="field-control">
            {isMultiLuogo ? (
              <button
                type="button"
                id="luogo"
                className="select select--lg luogo-trigger"
                onClick={() => setLuogoPickerOpen(true)}
                disabled={locked}
              >
                <span className={luogoSummary ? undefined : "luogo-trigger__ph"}>
                  {luogoSummary || "Scegli i luoghi"}
                </span>
                <ChevronDown size={18} aria-hidden className="luogo-trigger__chev" />
              </button>
            ) : (
              <select className="select select--lg" id="luogo" value={luogo} onChange={(e) => setLuogo(e.target.value)} required disabled={locked}>
                <option value="" disabled hidden />
                <optgroup label="Vigne">
                  {opts.luoghiVigne.map((l) => (
                    <option key={`vigne-${l}`} value={l}>{l}</option>
                  ))}
                </optgroup>
                <optgroup label="Altro">
                  {opts.luoghiAltro.map((l) => (
                    <option key={`altro-${l}`} value={l}>{l}</option>
                  ))}
                </optgroup>
                {luogo &&
                  luogo !== RESERVED_OPTION &&
                  !opts.luoghiVigne.includes(luogo) &&
                  !opts.luoghiAltro.includes(luogo) && (
                    <option value={luogo}>{luogo}</option>
                  )}
                <option value={RESERVED_OPTION}>{RESERVED_OPTION}</option>
              </select>
            )}
          </div>
          {isMultiLuogo && (
            <p className="field-help">Trattore: puoi scegliere più vigne.</p>
          )}
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

      <BottomSheet
        open={luogoPickerOpen}
        onClose={() => setLuogoPickerOpen(false)}
        title="Luoghi"
        subtitle="Seleziona una o più vigne dove ha lavorato il trattore."
      >
        <div className="luogo-multi">
          <p className="luogo-multi__group">Vigne</p>
          {opts.luoghiVigne.map(renderLuogoToggle)}
          <p className="luogo-multi__group">Altro</p>
          {opts.luoghiAltro.map(renderLuogoToggle)}
          {renderLuogoToggle(RESERVED_OPTION)}
          {extraLuoghi.map(renderLuogoToggle)}
        </div>
        <div className="sheet__actions">
          <button
            type="button"
            className="btn btn--primary btn--block btn--sheet"
            onClick={() => setLuogoPickerOpen(false)}
          >
            Fatto{selectedLuoghi.length ? ` (${selectedLuoghi.length})` : ""}
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
