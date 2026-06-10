"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Pencil, Plus, Search } from "lucide-react";
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
  /** Reserved catch-all shown as a locked, non-editable entry. */
  reservedLabel: string;
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
  reservedLabel,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState<ManagedOption[]>(sortByName(initial));
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"vigne" | "altro">("vigne");
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ManagedOption | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  async function confirmDelete() {
    if (!deleteTarget || deleteLoading) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/${resource}/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(typeof data.error === "string" ? data.error : "Errore.");
        return;
      }
      const removedId = deleteTarget.id;
      setItems((prev) => prev.filter((it) => it.id !== removedId));
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setDeleteError("Connessione assente. Riprova.");
    } finally {
      setDeleteLoading(false);
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
        onDelete={() => {
          setDeleteError(null);
          setDeleteTarget(item);
        }}
      >
        <div className="card opt-card">
          <span className="opt-card__name">{item.name}</span>
          <button
            type="button"
            className="opt-card__edit"
            onClick={() => openEdit(item)}
            aria-label={`Rinomina ${item.name}`}
          >
            <Pencil size={18} aria-hidden />
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
          <Plus size={18} aria-hidden />
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

          {/* Reserved catch-all: always available, not editable or deletable. */}
          {!q && (
            <div className="card opt-card opt-card--locked">
              <span className="opt-card__name">{reservedLabel}</span>
              <Lock size={16} className="opt-card__lock" aria-hidden />
            </div>
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
            Le voci già registrate mantengono il nome precedente; il nuovo nome
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
            {formLoading ? "Salvataggio…" : formMode === "create" ? labels.newButton : "Salva"}
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

      {/* Delete confirm */}
      <BottomSheet
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Elimina voce"
        subtitle={
          deleteTarget
            ? `"${deleteTarget.name}" non comparirà più nei nuovi inserimenti. Le voci già registrate restano invariate.`
            : undefined
        }
      >
        {deleteError && <p className="field-error">{deleteError}</p>}
        <div className="sheet__actions">
          <button
            type="button"
            className="btn btn--danger-outline btn--block"
            onClick={confirmDelete}
            disabled={deleteLoading}
          >
            {deleteLoading ? "Elimino…" : "Elimina"}
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--block btn--sheet-secondary"
            onClick={() => setDeleteTarget(null)}
          >
            Annulla
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
