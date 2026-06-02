type FormAlertProps = {
  variant: "error" | "success";
  children: React.ReactNode;
};

export function FormAlert({ variant, children }: FormAlertProps) {
  return (
    <div
      className={`login-form__alert login-form__alert--${variant}`}
      role="alert"
    >
      {variant === "error" ? (
        <svg
          className="login-form__alert-icon"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
        >
          <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M10 6.5v4.5M10 13.5h.01"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg
          className="login-form__alert-icon"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
        >
          <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M6.5 10.2 8.8 12.5 13.5 7.8"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <p className="login-form__alert-text">{children}</p>
    </div>
  );
}
