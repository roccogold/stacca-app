/** Log errors without dumping full API response bodies (credentials, tokens). */
export function logError(scope: string, err: unknown): void {
  if (err instanceof Error) {
    console.error(`[${scope}]`, err.message);
    return;
  }
  console.error(`[${scope}]`, String(err));
}
