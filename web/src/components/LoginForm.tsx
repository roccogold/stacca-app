"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useTransition, useState } from "react";
import Link from "next/link";
import { FormAlert } from "@/components/FormAlert";
import { PasswordInput } from "@/components/PasswordInput";

export function LoginForm() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const resetOk = searchParams.get("reset") === "ok";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    router.prefetch("/");
  }, [router]);

  function clearError() {
    setError((current) => (current ? null : current));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Email o password non corretti",
        );
        setLoading(false);
        return;
      }
      const dest = data.mustChangePassword ? "/login/nuova-password" : "/";
      document.dispatchEvent(new Event("stacca:navigate"));
      startTransition(() => {
        router.replace(dest);
      });
      void router.refresh();
    } catch {
      setError("Errore di connessione");
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={onSubmit}>
      {resetOk && (
        <FormAlert variant="success">Password aggiornata. Ora puoi entrare.</FormAlert>
      )}
      <div className="field">
        <label className="field-label field-label--plain" htmlFor="email">
          Email
        </label>
        <input
          className={`input input--lg${error ? " input--invalid" : ""}`}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="La tua email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clearError();
          }}
          aria-invalid={error ? true : undefined}
          required
        />
      </div>
      <div className="field">
        <label className="field-label field-label--plain" htmlFor="password">
          Password
        </label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(v) => {
            setPassword(v);
            clearError();
          }}
          invalid={!!error}
        />
      </div>
      {error && <FormAlert variant="error">{error}</FormAlert>}
      <button
        className="btn btn--primary btn--block btn--sheet login-form__submit"
        type="submit"
        disabled={loading}
      >
        {loading ? "Accesso…" : "Entra"}
      </button>
      <p className="login-form__links">
        <Link href="/login/recupera" className="login-form__link">
          Password dimenticata?
        </Link>
      </p>
    </form>
  );
}
