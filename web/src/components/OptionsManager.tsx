"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  ChevronDown,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { SwipeToDelete } from "@/components/SwipeToDelete";

export type ManagedOption = {
  id: string;
  name: string;
  archived: boolean;
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"vigne" | "altro">("vigne");
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [archiveTarget, setArchiveTarget] = useState<ManagedOption | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  async function setArchived(item: ManagedOption, archived: boolean) {
    setTogglingId(item.id);
    setBannerError(null);
    try {
      const res = await fetch(`/api/admin/${resource}/${item.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Errore");
      }
      setItems((prev) =>
        sortByName(prev.map((it) => (it.id === item.id ? { ...it, archived } : it))),
      );
      router.refresh();
    } catch (e) {
      setBannerError(e instanceof Error ? e.message : "Errore.");
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmArchive() {
    if (!archiveTarget || archiveLoading) return;
    setArchiveLoading(true);
    setArchiveError(null);
    try {
      const res = await fetch(`/api/admin/${resource}/${archiveTarget.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setArchiveError(typeof data.error === "string" ? data.error : "Errore.");
        return;
      }
      const removedId = archiveTarget.id;
      setItems((prev) =>
        sortByName(prev.map((it) => (it.id === removedId ? { ...it, archived: true } : it))),
      );
      setArchiveTarget(null);
      router.refresh();
    } catch {
      setArchiveError("Connessione assente. Riprova.");
    } finally {
      setArchiveLoading(false);
    }
  }

  const q = search.trim().toLowerCase();
  const matches = (it: ManagedOption) => !q || it.name.toLowerCase().includes(q);
  const active = items.filter((it) => !it.archived && matches(it));
  const archived = items.filter((it) => it.archived && matches(it));
  const archivedOpen = showArchived || q.length > 0;

  function renderCard(item: ManagedOption) {
    const open = expanded.has(item.id);
    return (
      <div
        key={item.id}
        className={`card emp-card${item.archived ? " emp-card--disabled" : ""}${open ? " emp-card--open" : ""}`}
      >
        <button
          type="button"
          className="emp-card__head"
          onClick={() => toggleExpand(item.id)}
        >
          <span className="emp-card__main">
            <span className="emp-card__name">{item.name}</span>
            {withCategory && (
              <span className="emp-card__email">
                {CATEGORY_LABEL[item.category ?? "altro"]}
              </span>
            )}
          </span>
          <span className="emp-card__meta">
            <ChevronDown
              size={20}
              className={`emp-card__chev${open ? " emp-card__chev--open" : ""}`}
              aria-hidden
            />
          </span>
        </button>
        {open && (
          <div className="emp-card__actions">
            <button type="button" className="emp-action" onClick={() => openEdit(item)}>
              <Pencil size={16} aria-hidden /> Rinomina
            </button>
            {item.archived ? (
              <button
                type="button"
                className="emp-action"
                onClick={() => setArchived(item, false)}
                disabled={togglingId === item.id}
              >
                <RotateCcw size={16} aria-hidden />
                {togglingId === item.id ? "…" : "Riattiva"}
              </button>
            ) : (
              <button
                type="button"
                className="emp-action emp-action--danger"
                onClick={() => {
                  setArchiveError(null);
                  setArchiveTarget(item);
                }}
              >
                <Ban size={16} aria-hidden /> Archivia
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // For luoghi, group the active list by category (Vigne first, then Altro).
  const groupedActive: Array<{ key: string; label: string; rows: ManagedOption[] }> =
    withCategory
      ? (["vigne", "altro"] as const)
          .map((cat) => ({
            key: cat,
            label: CATEGORY_LABEL[cat],
            rows: active.filter((it) => (it.category ?? "altro") === cat),
          }))
          .filter((g) => g.rows.length > 0)
      : [{ key: "all", label: "", rows: active }];

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
          {active.length} {active.length === 1 ? labels.countOne : labels.countMany}
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

        {bannerError && <p className="field-error">{bannerError}</p>}

        <div className="emp-list">
          {active.length === 0 ? (
            <p className="emp-empty">Nessun risultato.</p>
          ) : (
            groupedActive.map((group) => (
              <div key={group.key}>
                {group.label && (
                  <p className="section-title section-title--inset">{group.label}</p>
                )}
                {group.rows.map((it) => renderCard(it))}
              </div>
            ))
          )}

          {/* Reserved catch-all: always available, not editable. */}
          {!q && (
            <div className="card emp-card emp-card--disabled">
              <div className="emp-card__head" style={{ cursor: "default" }}>
                <span className="emp-card__main">
                  <span className="emp-card__name">{reservedLabel}</span>
                  <span className="emp-card__email">Voce fissa · sempre disponibile</span>
                </span>
                <span className="emp-card__meta">
                  <Lock size={16} aria-hidden />
                </span>
              </div>
            </div>
          )}
        </div>

        {archived.length > 0 && (
          <div className="emp-disabled-group">
            <button
              type="button"
              className="emp-disabled-toggle"
              onClick={() => setShowArchived((v) => !v)}
              aria-expanded={archivedOpen}
            >
              <ChevronDown
                size={18}
                className={`emp-disabled-toggle__chev${archivedOpen ? " emp-disabled-toggle__chev--open" : ""}`}
                aria-hidden
              />
              Archiviati ({archived.length})
            </button>
            {archivedOpen && (
              <div className="emp-list emp-list--disabled">
                {archived.map((it) => (
                  <SwipeToDelete
                    key={it.id}
                    onDelete={() => {
                      setArchiveError(null);
                      setArchiveTarget(it);
                    }}
                  >
                    {renderCard(it)}
                  </SwipeToDelete>
                ))}
              </div>
            )}
          </div>
        )}
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

      {/* Archive confirm */}
      <BottomSheet
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        title="Archivia voce"
        subtitle={
          archiveTarget
            ? `"${archiveTarget.name}" non comparirà più nei nuovi inserimenti. Le voci già registrate restano invariate. Puoi riattivarla quando vuoi.`
            : undefined
        }
      >
        {archiveError && <p className="field-error">{archiveError}</p>}
        <div className="sheet__actions">
          <button
            type="button"
            className="btn btn--primary btn--block btn--sheet"
            onClick={confirmArchive}
            disabled={archiveLoading}
          >
            {archiveLoading ? "Archiviazione…" : "Archivia"}
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--block btn--sheet-secondary"
            onClick={() => setArchiveTarget(null)}
          >
            Annulla
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
