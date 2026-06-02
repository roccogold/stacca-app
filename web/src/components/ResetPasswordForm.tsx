"use client";

import { FormAlert } from "@/components/FormAlert";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResetPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Errore");
        return;
      }
      setInfo(
        typeof data.message === "string"
          ? data.message
          : "Controlla la tua email.",
      );
      setStep("code");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password, confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Errore");
        return;
      }
      router.push("/login?reset=ok");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (step === "email") {
    return (
      <form className="login-form" onSubmit={sendCode}>
        <p className="login-form__intro">
          Inserisci la tua email, ti inviamo un codice a 6 cifre.
        </p>
        <div className="field">
          <label className="field-label field-label--plain" htmlFor="email">
            Email
          </label>
          <input
            className={`input input--lg${error ? " input--invalid" : ""}`}
            id="email"
            type="email"
            autoComplete="email"
            placeholder="nome@corzanoepaterno.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
            required
          />
        </div>
        {error && <FormAlert variant="error">{error}</FormAlert>}
        <button
          className="btn btn--primary btn--block btn--sheet login-form__submit"
          type="submit"
          disabled={loading}
        >
          {loading ? "Invio…" : "Invia codice"}
        </button>
        <Link href="/login" className="login-form__back link-plain">
          ← Torna al login
        </Link>
      </form>
    );
  }

  return (
    <form className="login-form" onSubmit={resetPassword}>
      {info && <FormAlert variant="success">{info}</FormAlert>}
      <div className="field">
        <label className="field-label field-label--plain" htmlFor="code">
          Codice (6 cifre)
        </label>
        <input
          className="input input--lg"
          id="code"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          required
        />
      </div>
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
        {loading ? "Salvataggio…" : "Reimposta password"}
      </button>
      <button
        type="button"
        className="login-form__back link-plain"
        style={{ background: "none", border: "none", width: "100%", cursor: "pointer" }}
        onClick={() => {
          setStep("email");
          setCode("");
          setError(null);
        }}
      >
        ← Usa un&apos;altra email
      </button>
    </form>
  );
}
