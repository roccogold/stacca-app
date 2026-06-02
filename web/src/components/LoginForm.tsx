"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Errore di accesso");
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
      {error && <p className="field-error login-form__error">{error}</p>}
      <div className="field">
        <label className="field-label field-label--plain" htmlFor="name">
          Nome
        </label>
        <input
          className="input input--lg"
          id="name"
          name="name"
          autoComplete="name"
          autoFocus
          placeholder="Il tuo nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
        />
      </div>
      <div className="field">
        <label className="field-label field-label--plain" htmlFor="password">
          Password
        </label>
        <input
          className="input input--lg"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••"
        />
      </div>
      <button className="btn btn--primary btn--block btn--sheet login-form__submit" type="submit" disabled={loading}>
        {loading ? "Accesso…" : "Entra"}
      </button>
    </form>
  );
}
