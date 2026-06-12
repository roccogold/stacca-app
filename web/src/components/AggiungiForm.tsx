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

/** Bundled single-area fallback — ultima risorsa offline senza cache. */
const FALLBACK_OPTIONS: EntryOptions = {
  areas: [
    {
      id: "fallback",
      name: "Vigna",
      lavorazioni: without(MANSIONI, RESERVED_OPTION),
      luoghi: [
        ...without(LUOGHI_VIGNE, RESERVED_OPTION),
        ...without(LUOGHI_ALTRO, RESERVED_OPTION),
      ],
    },
  ],
};

function initialHoursValue(existing: number | undefined): number {
  if (existing != null && existing > 0) return existing;
  return 0;
}

function defaultArea(initialArea: string | undefined, opts: EntryOptions): string {
  if (initialArea) return initialArea;
  return opts.areas.length === 1 ? opts.areas[0].name : "";
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

  // Opzioni per area: props server → cache localStorage → fallback bundle.
  const [opts, setOpts] = useState<EntryOptions>(() => options ?? FALLBACK_OPTIONS);
  const optionsKey = options ? JSON.stringify(options) : "";

  const [date, setDate] = useState(defaultDate);
  const [hours, setHours] = useState(() => initialHoursValue(initial?.hours));
  const [area, setArea] = useState(() =>
    defaultArea(initial?.area, options ?? FALLBACK_OPTIONS),
  );
  const [mansione, setMansione] = useState(initial?.mansione ?? "");
  const [luogo, setLuogo] = useState(initial?.luogo ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingLoaded, setPendingLoaded] = useState(!editLocalId);
  const [luogoPickerOpen, setLuogoPickerOpen] = useState(false);

  useEffect(() => {
    if (optionsKey) {
      cacheOptions(JSON.parse(optionsKey) as EntryOptions);
    } else {
      const cached = readCachedOptions();
      if (cached && cached.areas.length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- external-store hydration on mount
        setOpts(cached);
      }
    }
  }, [optionsKey]);

  // Una sola area → selezionala d'ufficio.
  useEffect(() => {
    if (!area && opts.areas.length === 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- default selection
      setArea(opts.areas[0].name);
    }
  }, [area, opts]);

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
      setArea(row.area);
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
        area,
        note: note.trim() || null,
      };
      const localId = editId && isLocalEntryId(editId) ? editId : null;
      const serverId =
        initial?.id ?? (editId && !isLocalEntryId(editId) ? editId : null);
      const clientId = localId ? parseLocalEntryId(localId) : null;

      await saveEntry({ serverId, clientId, payload });
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

  // ── Aree e opzioni filtrate ────────────────────────────────────────────────
  const areas = opts.areas;
  const noAreas = areas.length === 0;
  const areaNames = areas.map((a) => a.name);
  // includi l'area della voce in modifica anche se non più tra le assegnate
  const selectableAreas =
    area && !areaNames.includes(area) ? [...areaNames, area] : areaNames;

  const currentArea = areas.find((a) => a.name === area);
  const areaLavorazioni = currentArea?.lavorazioni ?? [];
  const areaLuoghi = currentArea?.luoghi ?? [];

  function onAreaChange(value: string) {
    setArea(value);
    setMansione("");
    setLuogo("");
  }

  // ── Luogo multi-selezione (Trattore) ───────────────────────────────────────
  const isMultiLuogo = mansione === MULTI_LUOGO_MANSIONE;
  const selectedLuoghi = useMemo(
    () => (luogo ? luogo.split(MULTI_LUOGO_SEP).filter(Boolean) : []),
    [luogo],
  );
  const luogoOrder = [...areaLuoghi, RESERVED_OPTION];
  const extraLuoghi = selectedLuoghi.filter((n) => !luogoOrder.includes(n));

  function onMansioneChange(value: string) {
    setMansione(value);
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

  const canSave =
    !loading && pendingLoaded && hours > 0 && !!area && !!mansione && !!luogo;

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

        {noAreas ? (
          <p className="form-hint">
            Nessun settore assegnato al tuo profilo. Contatta l&apos;amministratore
            per essere abilitato a registrare le ore.
          </p>
        ) : (
          <>
            {!editId && !locked && (
              <p className="form-hint">
                Puoi scegliere qualsiasi giorno in un mese ancora{" "}
                <strong>aperto</strong> (non inviato). Stai registrando{" "}
                <span className="capitalize">{monthLabelFromDateISO(date)}</span>.
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
                  onChange={(e) => setDate(clampISODate(e.target.value, minDate, maxDate))}
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

            {selectableAreas.length > 1 && (
              <div className="field">
                <label className="field-label field-label--plain" htmlFor="area">
                  Settore
                </label>
                <div className="field-control">
                  <select
                    className="select select--lg"
                    id="area"
                    value={area}
                    onChange={(e) => onAreaChange(e.target.value)}
                    required
                    disabled={locked}
                  >
                    <option value="" disabled hidden />
                    {selectableAreas.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="field">
              <label className="field-label field-label--plain" htmlFor="lavorazione">
                Lavorazione
              </label>
              <div className="field-control">
                <select className="select select--lg" id="lavorazione" value={mansione} onChange={(e) => onMansioneChange(e.target.value)} required disabled={locked}>
                  <option value="" disabled hidden />
                  {areaLavorazioni.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  {mansione &&
                    mansione !== RESERVED_OPTION &&
                    !areaLavorazioni.includes(mansione) && (
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
                    {areaLuoghi.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                    {luogo &&
                      luogo !== RESERVED_OPTION &&
                      !areaLuoghi.includes(luogo) && (
                        <option value={luogo}>{luogo}</option>
                      )}
                    <option value={RESERVED_OPTION}>{RESERVED_OPTION}</option>
                  </select>
                )}
              </div>
              {isMultiLuogo && (
                <p className="field-help">Trattore: puoi scegliere più luoghi.</p>
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
          </>
        )}
      </main>

      {!locked && !noAreas && (
        <div className="form-footer">
          <div className="form-footer__inner">
            <button
              type="button"
              className="btn btn--primary btn--block btn--sheet"
              onClick={save}
              disabled={!canSave}
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
        subtitle="Seleziona uno o più luoghi dove ha lavorato il trattore."
      >
        <div className="luogo-multi">
          {areaLuoghi.map(renderLuogoToggle)}
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
