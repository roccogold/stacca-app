/**
 * Copy to workers.local.ts (gitignored) and fill in real names/emails.
 * Password demo format: {handle}-{suffix}
 * `role` is optional and defaults to "dipendente". Set "admin" to grant
 * access to the Dipendenti management tab.
 */
export const WORKERS = [
  {
    handle: "rocco",
    firstName: "Rocco",
    lastName: "Rossi",
    email: "tu@example.com",
    suffix: "847392651",
    role: "admin",
  },
  {
    handle: "mario",
    firstName: "Mario",
    lastName: "Bianchi",
    email: "mario@example.com",
    suffix: "384729156",
    // role omesso → "dipendente"
  },
] as const;
