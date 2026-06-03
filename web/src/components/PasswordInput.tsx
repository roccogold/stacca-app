"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  invalid?: boolean;
  placeholder?: string;
  minLength?: number;
};

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  invalid,
  placeholder = "••••••",
  minLength,
}: Props) {
  const [show, setShow] = useState(false);

  return (
    <div className="input-password">
      <input
        className={`input input--lg input-password__input${invalid ? " input--invalid" : ""}`}
        id={id}
        name={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        minLength={minLength}
        required
      />
      <button
        type="button"
        className="input-password__toggle"
        aria-label={show ? "Nascondi password" : "Mostra password"}
        aria-pressed={show}
        onClick={() => setShow((v) => !v)}
      >
        {show ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
      </button>
    </div>
  );
}
