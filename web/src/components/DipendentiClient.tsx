"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  Copy,
  KeyRound,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  UserPlus,
} from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";

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
};

type Props = {
  currentUserId: string;
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

export function DipendentiClient({ currentUserId, initialUsers }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<Employee[]>(sortEmployees(initialUsers));
  const [search, setSearch] = useState("");

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

  // Disable (deactivate) confirmation sheet — never deletes data
  const [disableTarget, setDisableTarget] = useState<Employee | null>(null);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disableLoading, setDisableLoading] = useState(false);

  // Delete (permanent) confirmation sheet — only for already-disabled users
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Inline busy + error for the reactivate buttons
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        fullName(u).toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q),
    );
  }, [users, search]);

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
        showPasswordResult(saved, data.temporaryPassword);
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

  function showPasswordResult(emp: Pick<Employee, "id" | "firstName" | "lastName">, password: string) {
    setPwUser({ id: emp.id, name: fullName(emp) });
    setPwValue(password);
    setPwMode("result");
    setPwError(null);
    setCopied(false);
    setPwOpen(true);
  }

  function askResetPassword(emp: Employee) {
    setPwUser({ id: emp.id, name: fullName(emp) });
    setPwValue(null);
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

  async function confirmDelete() {
    if (!deleteTarget || deleteLoading) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(typeof data.error === "string" ? data.error : "Errore nell'eliminazione.");
        return;
      }
      const removedId = deleteTarget.id;
      setUsers((prev) => prev.filter((u) => u.id !== removedId));
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setDeleteError("Connessione assente. Riprova.");
    } finally {
      setDeleteLoading(false);
    }
  }

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
          {visible.length === 0 ? (
            <p className="emp-empty">Nessun risultato.</p>
          ) : (
            visible.map((emp) => (
              <div
                key={emp.id}
                className={`card emp-card${emp.disabled ? " emp-card--disabled" : ""}`}
              >
                <div className="emp-card__head">
                  <div>
                    <div className="emp-card__name">{fullName(emp) || emp.displayName}</div>
                    <div className="emp-card__email">{emp.email ?? "—"}</div>
                    {emp.disabled ? (
                      <div className="emp-card__pending emp-card__pending--off">
                        Accesso disattivato
                      </div>
                    ) : emp.mustChangePassword ? (
                      <div className="emp-card__pending">In attesa del primo accesso</div>
                    ) : null}
                  </div>
                  <span className={`badge ${emp.role === "admin" ? "badge--ok" : "badge--locked"}`}>
                    {emp.role === "admin" ? "Admin" : "Dipendente"}
                  </span>
                </div>
                <div className="emp-card__actions">
                  <button type="button" className="emp-action" onClick={() => openEdit(emp)}>
                    <Pencil size={16} aria-hidden />
                    Modifica
                  </button>
                  <button
                    type="button"
                    className="emp-action"
                    onClick={() => askResetPassword(emp)}
                  >
                    <KeyRound size={16} aria-hidden />
                    Password
                  </button>
                  {emp.disabled ? (
                    <>
                      <button
                        type="button"
                        className="emp-action"
                        onClick={() => reactivate(emp)}
                        disabled={togglingId === emp.id}
                      >
                        <RotateCcw size={16} aria-hidden />
                        {togglingId === emp.id ? "…" : "Riattiva"}
                      </button>
                      <button
                        type="button"
                        className="emp-action emp-action--danger"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleteTarget(emp);
                        }}
                      >
                        <Trash2 size={16} aria-hidden />
                        Elimina
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="emp-action emp-action--danger"
                      onClick={() => {
                        setDisableError(null);
                        setDisableTarget(emp);
                      }}
                      disabled={emp.id === currentUserId}
                      title={
                        emp.id === currentUserId
                          ? "Non puoi disattivare te stesso"
                          : undefined
                      }
                    >
                      <Ban size={16} aria-hidden />
                      Disattiva
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
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
            {formLoading ? "Salvataggio…" : formMode === "create" ? "Crea dipendente" : "Salva"}
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
            {pwError && <p className="field-error">{pwError}</p>}
            <div className="sheet__actions">
              <button
                type="button"
                className="btn btn--primary btn--block btn--sheet"
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
              <button
                type="button"
                className="btn btn--secondary btn--block btn--sheet-secondary"
                onClick={() => setPwOpen(false)}
              >
                Fatto
              </button>
            </div>
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

      {/* Disable (deactivate) confirmation — data is kept */}
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

      {/* Delete (permanent) confirmation — only for disabled accounts */}
      <BottomSheet
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Elimina definitivamente"
        subtitle={
          deleteTarget
            ? `Rimuovi ${deleteTarget.firstName || deleteTarget.displayName} e le sue ore dal database. I dati già esportati su Google Sheets restano. Azione irreversibile.`
            : undefined
        }
      >
        {deleteError && <p className="field-error">{deleteError}</p>}
        <div className="sheet__actions">
          <button
            type="button"
            className="btn btn--logout btn--block btn--sheet"
            onClick={confirmDelete}
            disabled={deleteLoading}
          >
            {deleteLoading ? "Elimino…" : "Elimina definitivamente"}
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
