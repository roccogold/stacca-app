/**
 * Copy to workers.local.ts (gitignored) and fill in real emails.
 * Password demo format: {handle}-{suffix}
 */
export const WORKERS = [
  {
    handle: "rocco",
    displayName: "Rocco",
    email: "tu@example.com",
    suffix: "847392651",
  },
  {
    handle: "arianna",
    displayName: "Arianna",
    email: "arianna@example.com",
    suffix: "384729156",
  },
] as const;
