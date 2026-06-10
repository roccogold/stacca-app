"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  ChevronDown,
  Copy,
  KeyRound,
  Pencil,
  RotateCcw,
  Search,
  UserPlus,
} from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { SwipeToDelete } from "@/components/SwipeToDelete";

type Role = "admin" | "dipendente";

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  role: Role;
  disabled: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  protected: boolean;
};

type Props = {
  currentUserId: string;
  currentUserIsProtected: boolean;
  initialUsers: Employee[];
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
};

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  role: "dipendente",
};

/** Admins first, then everyone alphabetically by name. */
function sortEmployees(list: Employee[]): Employee[] {
  return [...list].sort((a, b) => {
    if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
    const byFirst = a.firstName.localeCompare(b.firstName, "it");
    return byFirst !== 0 ? byFirst : a.lastName.localeCompare(b.lastName, "it");
  });
}

function fullName(e: Pick<Employee, "firstName" | "lastName">): string {
  return `${e.firstName} ${e.lastName}`.trim();
}

export function DipendentiClient({
  currentUserId,
  currentUserIsProtected,
  initialUsers,
}: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<Employee[]>(sortEmployees(initialUsers));
  const [search, setSearch] = useState("");
  const [showDisabled, setShowDisabled] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Create / edit form sheet
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Password sheet (confirm reset → show generated password once)
  const [pwOpen, setPwOpen] = useState(false);
  const [pwMode, setPwMode] = useState<"confirm" | "result">("result");
  const [pwUser, setPwUser] = useState<{ id: string; name: string } | null>(null);
  const [pwValue, setPwValue] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pwEmailNote, setPwEmailNote] = useState<string | null>(null);
  // True when the temp password was also emailed (create flow, best-effort).
  // Drives which action is primary: if delivered by email, "Fatto" leads and
  // "Copia e condividi" is the fallback; otherwise the admin must share it.
  const [pwEmailSent, setPwEmailSent] = useState(false);

  // Disable (deactivate) confirmation sheet — never deletes data
  const [disableTarget, setDisableTarget] = useState<Employee | null>(null);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disableLoading, setDisableLoading] = useState(false);

  // Archive (hide from list) confirmation — never deletes data
  const [archiveTarget, setArchiveTarget] = useState<Employee | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // Inline busy + error for the reactivate buttons
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  function openCreate() {
    setFormMode("create");
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(emp: Employee) {
    setFormMode("edit");
    setEditId(emp.id);
    setForm({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email ?? "",
      role: emp.role,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function submitForm() {
    if (formLoading) return;
    if (!form.firstName.trim() || !form.email.trim()) {
      setFormError("Nome ed email sono obbligatori.");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        role: form.role,
      };
      const url =
        formMode === "create" ? "/api/admin/users" : `/api/admin/users/${editId}`;
      const method = formMode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(typeof data.error === "string" ? data.error : "Errore nel salvataggio.");
        return;
      }
      const saved: Employee = data.user;
      if (formMode === "create") {
        setUsers((prev) => sortEmployees([...prev, saved]));
        setFormOpen(false);
        const note = data.emailSent
          ? `Inviata anche via email a ${saved.email ?? "—"}`
          : "Email non inviata — condividi la password a mano.";
        showPasswordResult(saved, data.temporaryPassword, note, !!data.emailSent);
      } else {
        setUsers((prev) => sortEmployees(prev.map((u) => (u.id === saved.id ? saved : u))));
        setFormOpen(false);
      }
      router.refresh();
    } catch {
      setFormError("Connessione assente. Riprova.");
    } finally {
      setFormLoading(false);
    }
  }

  function showPasswordResult(
    emp: Pick<Employee, "id" | "firstName" | "lastName">,
    password: string,
    emailNote?: string | null,
    emailSent = false,
  ) {
    setPwUser({ id: emp.id, name: fullName(emp) });
    setPwValue(password);
    setPwEmailNote(emailNote ?? null);
    setPwEmailSent(emailSent);
    setPwMode("result");
    setPwError(null);
    setCopied(false);
    setPwOpen(true);
  }

  function askResetPassword(emp: Employee) {
    setPwUser({ id: emp.id, name: fullName(emp) });
    setPwValue(null);
    setPwEmailNote(null);
    setPwMode("confirm");
    setPwError(null);
    setPwOpen(true);
  }

  async function confirmResetPassword() {
    if (!pwUser || pwLoading) return;
    setPwLoading(true);
    setPwError(null);
    try {
      const res = await fetch(`/api/admin/users/${pwUser.id}/reset-password`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPwError(typeof data.error === "string" ? data.error : "Errore.");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === pwUser.id ? { ...u, mustChangePassword: true } : u)),
      );
      setPwValue(data.temporaryPassword);
      setPwEmailSent(false); // reset flow never emails; admin shares manually
      setPwMode("result");
      setCopied(false);
      router.refresh();
    } catch {
      setPwError("Connessione assente. Riprova.");
    } finally {
      setPwLoading(false);
    }
  }

  async function copyPassword() {
    if (!pwValue) return;
    try {
      await navigator.clipboard.writeText(pwValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setPwError("Copia non riuscita. Selezionala e copiala a mano.");
    }
  }

  async function setDisabled(emp: Employee, disabled: boolean) {
    const res = await fetch(`/api/admin/users/${emp.id}/disable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data.error === "string" ? data.error : "Errore.");
    }
    const saved: Employee = data.user;
    setUsers((prev) => sortEmployees(prev.map((u) => (u.id === saved.id ? saved : u))));
    router.refresh();
  }

  async function reactivate(emp: Employee) {
    if (togglingId) return;
    setTogglingId(emp.id);
    setBannerError(null);
    try {
      await setDisabled(emp, false);
    } catch (e) {
      setBannerError(e instanceof Error ? e.message : "Errore nella riattivazione.");
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDisable() {
    if (!disableTarget || disableLoading) return;
    setDisableLoading(true);
    setDisableError(null);
    try {
      await setDisabled(disableTarget, true);
      setDisableTarget(null);
    } catch (e) {
      setDisableError(e instanceof Error ? e.message : "Connessione assente. Riprova.");
    } finally {
      setDisableLoading(false);
    }
  }

  async function confirmArchive() {
    if (!archiveTarget || archiveLoading) return;
    setArchiveLoading(true);
    setArchiveError(null);
    try {
      const res = await fetch(`/api/admin/users/${archiveTarget.id}/archive`, {
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
      setUsers((prev) => prev.filter((u) => u.id !== removedId));
      setArchiveTarget(null);
      router.refresh();
    } catch {
      setArchiveError("Connessione assente. Riprova.");
    } finally {
      setArchiveLoading(false);
    }
  }

  function renderCard(emp: Employee) {
    // Protected owner account: other admins can't edit / reset / disable it.
    const locked = emp.protected && !currentUserIsProtected;
    const lockTitle = locked
      ? "Account protetto: gestibile solo dal titolare"
      : undefined;
    const open = expanded.has(emp.id);
    return (
      <div
        key={emp.id}
        className={`card emp-card${emp.disabled ? " emp-card--disabled" : ""}${open ? " emp-card--open" : ""}`}
      >
        <button
          type="button"
          className="emp-card__head"
          onClick={() => toggleExpand(emp.id)}
          aria-expanded={open}
        >
          <span className="emp-card__main">
            <span className="emp-card__name">{fullName(emp) || emp.displayName}</span>
            <span className="emp-card__email">{emp.email ?? "—"}</span>
            {emp.disabled ? (
              <span className="emp-card__pending emp-card__pending--off">
                Accesso disattivato
              </span>
            ) : emp.mustChangePassword ? (
              <span className="emp-card__pending">In attesa del primo accesso</span>
            ) : null}
          </span>
          <span className="emp-card__meta">
            <span className={`badge ${emp.role === "admin" ? "badge--ok" : "badge--locked"}`}>
              {emp.role === "admin" ? "Admin" : "Dipendente"}
            </span>
            <ChevronDown
              size={20}
              className={`emp-card__chev${open ? " emp-card__chev--open" : ""}`}
              aria-hidden
            />
          </span>
        </button>
        {open && (
        <div className="emp-card__actions">
          <button
            type="button"
            className="emp-action"
            onClick={() => openEdit(emp)}
            disabled={locked}
            title={lockTitle}
          >
            <Pencil size={16} aria-hidden />
            Modifica
          </button>
          <button
            type="button"
            className="emp-action"
            onClick={() => askResetPassword(emp)}
            disabled={locked}
            title={lockTitle}
          >
            <KeyRound size={16} aria-hidden />
            Password
          </button>
          {emp.disabled ? (
            <button
              type="button"
              className="emp-action"
              onClick={() => reactivate(emp)}
              disabled={locked || togglingId === emp.id}
              title={lockTitle}
            >
              <RotateCcw size={16} aria-hidden />
              {togglingId === emp.id ? "…" : "Riattiva"}
            </button>
          ) : (
            <button
              type="button"
              className="emp-action emp-action--danger"
              onClick={() => {
                setDisableError(null);
                setDisableTarget(emp);
              }}
              disabled={locked || emp.id === currentUserId}
              title={
                locked
                  ? lockTitle
                  : emp.id === currentUserId
                    ? "Non puoi disattivare te stesso"
                    : undefined
              }
            >
              <Ban size={16} aria-hidden />
              Disattiva
            </button>
          )}
        </div>
        )}
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const matchesQuery = (u: Employee) =>
    !q ||
    fullName(u).toLowerCase().includes(q) ||
    (u.email ?? "").toLowerCase().includes(q);
  const activeList = users.filter((u) => !u.disabled && matchesQuery(u));
  const disabledList = users.filter((u) => u.disabled && matchesQuery(u));
  const nothing = activeList.length === 0 && disabledList.length === 0;
  const disabledOpen = showDisabled || q.length > 0;

  return (
    <>
      <header className="page-header page-header--loose">
        <h1 className="h1">Dipendenti</h1>
      </header>

      <section className="block block--tight">
        <button type="button" className="btn btn--primary btn--block" onClick={openCreate}>
          <UserPlus size={18} aria-hidden />
          Nuovo dipendente
        </button>
      </section>

      <section className="block block--spaced">
        <h2 className="section-title section-title--inset">
          {users.length} {users.length === 1 ? "persona" : "persone"}
        </h2>

        <div className="emp-search">
          <Search size={18} className="emp-search__icon" aria-hidden />
          <input
            className="input emp-search__input"
            type="search"
            placeholder="Cerca per nome o email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Cerca dipendente"
          />
        </div>

        {bannerError && <p className="field-error">{bannerError}</p>}

        <div className="emp-list">
          {nothing ? (
            <p className="emp-empty">Nessun risultato.</p>
          ) : (
            activeList.map((e) => renderCard(e))
          )}
        </div>

        {disabledList.length > 0 && (
          <div className="emp-disabled-group">
            <button
              type="button"
              className="emp-disabled-toggle"
              onClick={() => setShowDisabled((v) => !v)}
              aria-expanded={disabledOpen}
            >
              <ChevronDown
                size={18}
                className={`emp-disabled-toggle__chev${disabledOpen ? " emp-disabled-toggle__chev--open" : ""}`}
                aria-hidden
              />
              Disattivati ({disabledList.length})
            </button>
            {disabledOpen && (
              <div className="emp-list emp-list--disabled">
                {disabledList.map((e) => {
                  // Protected account can't be archived by others → no swipe.
                  const locked = e.protected && !currentUserIsProtected;
                  return locked ? (
                    renderCard(e)
                  ) : (
                    <SwipeToDelete
                      key={e.id}
                      onDelete={() => {
                        setArchiveError(null);
                        setArchiveTarget(e);
                      }}
                    >
                      {renderCard(e)}
                    </SwipeToDelete>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Create / edit */}
      <BottomSheet
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={formMode === "create" ? "Nuovo dipendente" : "Modifica dipendente"}
        subtitle={
          formMode === "create"
            ? "Genera un account con password temporanea."
            : undefined
        }
      >
        <div className="field">
          <label className="field-label" htmlFor="emp-firstName">
            Nome
          </label>
          <input
            id="emp-firstName"
            className="input"
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="emp-lastName">
            Cognome
          </label>
          <input
            id="emp-lastName"
            className="input"
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="emp-email">
            Email
          </label>
          <input
            id="emp-email"
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="emp-role">
            Ruolo
          </label>
          <select
            id="emp-role"
            className="select"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
          >
            <option value="dipendente">Dipendente</option>
            <option value="admin">Admin</option>
          </select>
        </div>
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

      {/* Password: confirm reset / show generated */}
      <BottomSheet
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title={pwMode === "confirm" ? "Rigenera password" : "Password temporanea"}
        subtitle={
          pwMode === "confirm"
            ? `La password attuale di ${pwUser?.name ?? ""} smetterà di funzionare.`
            : `Per ${pwUser?.name ?? ""}. Si vede una sola volta — copiala e consegnala.`
        }
      >
        {pwMode === "result" && pwValue && (
          <>
            <div className="emp-pw-box">{pwValue}</div>
            {pwEmailNote && <p className="emp-pw-note">{pwEmailNote}</p>}
            {pwError && <p className="field-error">{pwError}</p>}
            {(() => {
              // When the password was emailed, "Fatto" is the primary action and
              // copying is the optional fallback; otherwise copying leads, since
              // the admin is the only delivery channel. Emphasised button first.
              const copyBtn = (
                <button
                  key="copy"
                  type="button"
                  className={`btn btn--block ${pwEmailSent ? "btn--secondary btn--sheet-secondary" : "btn--primary btn--sheet"}`}
                  onClick={copyPassword}
                >
                  {copied ? (
                    <>
                      <Check size={20} aria-hidden /> Copiata
                    </>
                  ) : (
                    <>
                      <Copy size={20} aria-hidden /> Copia e condividi
                    </>
                  )}
                </button>
              );
              const doneBtn = (
                <button
                  key="done"
                  type="button"
                  className={`btn btn--block ${pwEmailSent ? "btn--primary btn--sheet" : "btn--secondary btn--sheet-secondary"}`}
                  onClick={() => setPwOpen(false)}
                >
                  Fatto
                </button>
              );
              return (
                <div className="sheet__actions">
                  {pwEmailSent ? [doneBtn, copyBtn] : [copyBtn, doneBtn]}
                </div>
              );
            })()}
          </>
        )}
        {pwMode === "confirm" && (
          <>
            {pwError && <p className="field-error">{pwError}</p>}
            <div className="sheet__actions">
              <button
                type="button"
                className="btn btn--primary btn--block btn--sheet"
                onClick={confirmResetPassword}
                disabled={pwLoading}
              >
                {pwLoading ? "Genero…" : "Genera nuova password"}
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--block btn--sheet-secondary"
                onClick={() => setPwOpen(false)}
              >
                Annulla
              </button>
            </div>
          </>
        )}
      </BottomSheet>

      {/* Disable (deactivate) confirmation — data is kept forever */}
      <BottomSheet
        open={disableTarget !== null}
        onClose={() => setDisableTarget(null)}
        title="Disattiva accesso"
        subtitle={
          disableTarget
            ? `${disableTarget.firstName || disableTarget.displayName} non potrà più accedere a Stacca. I suoi dati (ore e mesi inviati) restano salvati. Puoi riattivarlo quando vuoi.`
            : undefined
        }
      >
        {disableError && <p className="field-error">{disableError}</p>}
        <div className="sheet__actions">
          <button
            type="button"
            className="btn btn--logout btn--block btn--sheet"
            onClick={confirmDisable}
            disabled={disableLoading}
          >
            {disableLoading ? "Disattivo…" : "Disattiva accesso"}
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--block btn--sheet-secondary"
            onClick={() => setDisableTarget(null)}
          >
            Annulla
          </button>
        </div>
      </BottomSheet>

      {/* Archive (remove from list) — keeps ALL data */}
      <BottomSheet
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        title="Rimuovi dalla lista"
        subtitle={
          archiveTarget
            ? `Sicuro? ${archiveTarget.firstName || archiveTarget.displayName} sparisce dalla lista. Tutti i suoi dati — ore, mesi e Google Sheets — restano salvati: è solo una pulizia di vista, non una cancellazione.`
            : undefined
        }
      >
        {archiveError && <p className="field-error">{archiveError}</p>}
        <div className="sheet__actions">
          <button
            type="button"
            className="btn btn--logout btn--block btn--sheet"
            onClick={confirmArchive}
            disabled={archiveLoading}
          >
            {archiveLoading ? "Rimuovo…" : "Rimuovi dalla lista"}
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
