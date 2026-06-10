"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Map, Pencil, Search } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { SwipeToDelete } from "@/components/SwipeToDelete";

export type ManagedOption = {
  id: string;
  name: string;
  category?: "vigne" | "altro";
};

type Labels = {
  title: string;
  newButton: string;
  createTitle: string;
  editTitle: string;
  nameLabel: string;
  countOne: string;
  countMany: string;
};

type Props = {
  resource: "lavorazioni" | "luoghi";
  initial: ManagedOption[];
  labels: Labels;
  withCategory?: boolean;
};

const CATEGORY_LABEL: Record<string, string> = {
  vigne: "Vigne",
  altro: "Altro",
};

function sortByName(list: ManagedOption[]): ManagedOption[] {
  return [...list].sort((a, b) => a.name.localeCompare(b.name, "it"));
}

export function OptionsManager({
  resource,
  initial,
  labels,
  withCategory = false,
}: Props) {
  const router = useRouter();
  // Icon for the "new" button, per resource (can't pass a component from the
  // server page to this client component).
  const NewIcon = resource === "lavorazioni" ? ClipboardList : Map;
  const [items, setItems] = useState<ManagedOption[]>(sortByName(initial));
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"vigne" | "altro">("vigne");
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  function openCreate() {
    setFormMode("create");
    setEditId(null);
    setName("");
    setCategory("vigne");
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(item: ManagedOption) {
    setFormMode("edit");
    setEditId(item.id);
    setName(item.name);
    setCategory(item.category ?? "vigne");
    setFormError(null);
    setFormOpen(true);
  }

  async function submitForm() {
    if (formLoading) return;
    if (!name.trim()) {
      setFormError("Il nome è obbligatorio.");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      const payload: { name: string; category?: string } = { name: name.trim() };
      if (withCategory) payload.category = category;
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
      const saved = (data.lavorazione ?? data.luogo) as ManagedOption | undefined;
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

  // For luoghi, group by category (Vigne first, then Altro); otherwise one list.
  const groups: Array<{ key: string; label: string; rows: ManagedOption[] }> =
    withCategory
      ? (["vigne", "altro"] as const)
          .map((cat) => ({
            key: cat,
            label: CATEGORY_LABEL[cat],
            rows: visible.filter((it) => (it.category ?? "altro") === cat),
          }))
          .filter((g) => g.rows.length > 0)
      : [{ key: "all", label: "", rows: visible }];

  function renderRow(item: ManagedOption) {
    return (
      <SwipeToDelete
        key={item.id}
        bare={false}
        onDelete={() => handleDelete(item)}
      >
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

        <div className="opt-list">
          {visible.length === 0 ? (
            <p className="emp-empty">Nessun risultato.</p>
          ) : (
            groups.map((group) => (
              <div key={group.key} className="opt-group">
                {group.label && (
                  <p className="section-title section-title--inset">{group.label}</p>
                )}
                {group.rows.map((it) => renderRow(it))}
              </div>
            ))
          )}

        </div>
      </section>

      {/* Create / edit */}
      <BottomSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={formMode === "create" ? labels.createTitle : labels.editTitle}
      >
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
        {withCategory && (
          <div className="field">
            <label className="field-label" htmlFor="opt-category">
              Categoria
            </label>
            <select
              id="opt-category"
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value as "vigne" | "altro")}
            >
              <option value="vigne">Vigne</option>
              <option value="altro">Altro</option>
            </select>
          </div>
        )}
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
