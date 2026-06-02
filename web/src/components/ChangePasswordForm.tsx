"use client";

import { FormAlert } from "@/components/FormAlert";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  forced?: boolean;
};

export function ChangePasswordForm({ forced = false }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Errore");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={onSubmit}>
      {forced && (
        <p className="login-form__intro">
          Scegli una password personale. D&apos;ora in poi entri con email + password.
        </p>
      )}
      <div className="field">
        <label className="field-label field-label--plain" htmlFor="password">
          Nuova password
        </label>
        <input
          className="input input--lg"
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="Almeno 8 caratteri"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      <div className="field">
        <label className="field-label field-label--plain" htmlFor="confirm">
          Ripeti password
        </label>
        <input
          className="input input--lg"
          id="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
        />
      </div>
      {error && <FormAlert variant="error">{error}</FormAlert>}
      <button
        className="btn btn--primary btn--block btn--sheet login-form__submit"
        type="submit"
        disabled={loading}
      >
        {loading ? "Salvataggio…" : "Salva"}
      </button>
      {!forced && (
        <Link href="/" className="login-form__back link-plain">
          Annulla
        </Link>
      )}
    </form>
  );
}
