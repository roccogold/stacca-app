"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ClipboardList,
  Layers,
  Map,
  Pencil,
  Search,
} from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { SwipeToDelete } from "@/components/SwipeToDelete";

export type ManagedOption = {
  id: string;
  name: string;
  areaId?: string | null;
};

export type AreaRef = { id: string; name: string };

type Labels = {
  title: string;
  newButton: string;
  createTitle: string;
  editTitle: string;
  nameLabel: string;
  countOne: string;
  countMany: string;
};

type Resource = "lavorazioni" | "luoghi" | "aree";

type Props = {
  resource: Resource;
  initial: ManagedOption[];
  labels: Labels;
  /** Aree disponibili: presenti per lavorazioni/luoghi, assenti per "aree". */
  areas?: AreaRef[];
};

const RESOURCE_ICON = {
  lavorazioni: ClipboardList,
  luoghi: Map,
  aree: Layers,
} as const;

function sortByName(list: ManagedOption[]): ManagedOption[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "it"));
}

export function OptionsManager({ resource, initial, labels, areas }: Props) {
  const router = useRouter();
  const NewIcon = RESOURCE_ICON[resource];
  const grouped = !!areas; // lavorazioni/luoghi raggruppati per area

  const [items, setItems] = useState<ManagedOption[]>(sortByName(initial));
  const [search, setSearch] = useState("");
  const [openAreas, setOpenAreas] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [areaId, setAreaId] = useState<string>(areas?.[0]?.id ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  function openCreate() {
    setFormMode("create");
    setEditId(null);
    setName("");
    setAreaId(areas?.[0]?.id ?? "");
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(item: ManagedOption) {
    setFormMode("edit");
    setEditId(item.id);
    setName(item.name);
    setAreaId(item.areaId ?? areas?.[0]?.id ?? "");
    setFormError(null);
    setFormOpen(true);
  }

  function toggleArea(id: string) {
    setOpenAreas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submitForm() {
    if (formLoading) return;
    if (!name.trim()) {
      setFormError("Il nome è obbligatorio.");
      return;
    }
    if (grouped && !areaId) {
      setFormError("Seleziona un settore.");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      const payload: { name: string; areaId?: string } = { name: name.trim() };
      if (grouped) payload.areaId = areaId;
      const url =
        formMode === "create"
          ? `/api/admin/${resource}`
          : `/api/admin/${resource}/${editId}`;
      const res = await fetch(url, {
        method: formMode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(typeof data.error === "string" ? data.error : "Errore nel salvataggio.");
        return;
      }
      const saved = (data.lavorazione ?? data.luogo ?? data.area) as
        | ManagedOption
        | undefined;
      if (!saved) {
        setFormError("Risposta non valida dal server.");
        return;
      }
      setItems((prev) =>
        formMode === "create"
          ? sortByName([...prev, saved])
          : sortByName(prev.map((it) => (it.id === saved.id ? saved : it))),
      );
      setFormOpen(false);
      router.refresh();
    } catch {
      setFormError("Connessione assente. Riprova.");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(item: ManagedOption) {
    if (!confirm(`Vuoi davvero eliminare "${item.name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/${resource}/${item.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof data.error === "string" ? data.error : "Errore nell'eliminazione.");
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== item.id));
      router.refresh();
    } catch {
      alert("Connessione assente. Riprova.");
    }
  }

  const q = search.trim().toLowerCase();
  const matches = (it: ManagedOption) => !q || it.name.toLowerCase().includes(q);
  const visible = items.filter(matches);

  function renderRow(item: ManagedOption) {
    return (
      <SwipeToDelete key={item.id} bare={false} onDelete={() => handleDelete(item)}>
        <div className="opt-row">
          <span className="opt-row__name">{item.name}</span>
          <button
            type="button"
            className="opt-row__edit"
            onClick={() => openEdit(item)}
            aria-label={`Rinomina ${item.name}`}
          >
            <Pencil size={15} aria-hidden />
          </button>
        </div>
      </SwipeToDelete>
    );
  }

  return (
    <>
      <header className="page-header page-header--loose">
        <h1 className="h1">{labels.title}</h1>
      </header>

      <section className="block block--tight">
        <button type="button" className="btn btn--primary btn--block" onClick={openCreate}>
          <NewIcon size={18} aria-hidden />
          {labels.newButton}
        </button>
      </section>

      <section className="block block--spaced">
        <h2 className="section-title section-title--inset">
          {items.length} {items.length === 1 ? labels.countOne : labels.countMany}
        </h2>

        <div className="emp-search">
          <Search size={18} className="emp-search__icon" aria-hidden />
          <input
            className="input emp-search__input"
            type="search"
            placeholder="Cerca per nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Cerca"
          />
        </div>

        {visible.length === 0 ? (
          <p className="emp-empty">Nessun risultato.</p>
        ) : grouped ? (
          <div className="opt-list">
            {areas!.map((area) => {
              const rows = visible.filter((it) => it.areaId === area.id);
              if (rows.length === 0) return null;
              const open = openAreas.has(area.id) || q.length > 0;
              return (
                <div key={area.id} className="opt-area">
                  <button
                    type="button"
                    className="opt-area__head"
                    onClick={() => toggleArea(area.id)}
                    aria-expanded={open}
                  >
                    <ChevronDown
                      size={18}
                      className={`opt-area__chev${open ? " opt-area__chev--open" : ""}`}
                      aria-hidden
                    />
                    {area.name}
                    <span className="opt-area__count">{rows.length}</span>
                  </button>
                  {open && <div className="opt-area__rows">{rows.map(renderRow)}</div>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="opt-list">{visible.map(renderRow)}</div>
        )}
      </section>

      {/* Create / edit */}
      <BottomSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={formMode === "create" ? labels.createTitle : labels.editTitle}
      >
        {grouped && (
          <div className="field">
            <label className="field-label" htmlFor="opt-area">
              Settore
            </label>
            <select
              id="opt-area"
              className="select"
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
            >
              {areas!.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label className="field-label" htmlFor="opt-name">
            {labels.nameLabel}
          </label>
          <input
            id="opt-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>
        {formMode === "edit" && (
          <p className="form-hint">
            Le voci già registrate mantengono il nome precedente. Il nuovo nome
            vale solo per i prossimi inserimenti.
          </p>
        )}
        {formError && <p className="field-error">{formError}</p>}
        <div className="sheet__actions">
          <button
            type="button"
            className="btn btn--primary btn--block btn--sheet"
            onClick={submitForm}
            disabled={formLoading}
          >
            {formLoading ? "Salvataggio…" : formMode === "create" ? "Aggiungi" : "Salva"}
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--block btn--sheet-secondary"
            onClick={() => setFormOpen(false)}
          >
            Annulla
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
