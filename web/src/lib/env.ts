const DEV_SESSION_FALLBACK = "dev-only-secret-min-32-characters-long!!";

const INSECURE_SESSION_SECRETS = new Set([
  DEV_SESSION_FALLBACK,
  "change-me-to-a-long-random-string-at-least-32-chars",
]);

function isHostedProduction(): boolean {
  return process.env.VERCEL === "1";
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32) {
      throw new Error(
        "SESSION_SECRET must be a random string of at least 32 characters in production.",
      );
    }
    if (isHostedProduction() && INSECURE_SESSION_SECRETS.has(secret)) {
      throw new Error(
        "SESSION_SECRET on Vercel must not use the example or dev default. Generate one with: openssl rand -base64 32",
      );
    }
    return secret;
  }
  return secret && secret.length >= 32 ? secret : DEV_SESSION_FALLBACK;
}

/** Fail fast when the production server starts with missing critical config. */
export function assertProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  getSessionSecret();

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required in production.");
  }
}
