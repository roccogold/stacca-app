/** Versione mostrata in profilo/login — aggiornare a ogni release visibile agli utenti. */
export const APP_VERSION = "1.0";

export function AppFooter() {
  return (
    <footer className="app-footer">
      <p className="app-footer__text">
        © 2026{" "}
        <a
          href="https://www.corzanoepaterno.com/"
          className="app-footer__link"
          target="_blank"
          rel="noopener noreferrer"
        >
          Fattoria Corzano e Paterno
        </a>
        <span className="app-footer__sep" aria-hidden>
          {" "}
          ·{" "}
        </span>
        <span className="app-footer__version">Versione {APP_VERSION}</span>
      </p>
    </footer>
  );
}
