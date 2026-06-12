/**
 * Client-side cache of the entry-form option lists (per the worker's areas) so
 * the form stays usable offline. Lists never include the reserved "Altro"
 * (appended in the UI).
 */
export type AreaOptions = {
  id: string;
  name: string;
  lavorazioni: string[];
  luoghi: string[];
};

export type EntryOptions = {
  areas: AreaOptions[];
};

const KEY = "stacca-entry-options-v2";

function isAreaOptions(x: unknown): x is AreaOptions {
  if (typeof x !== "object" || x === null) return false;
  const a = x as Record<string, unknown>;
  return (
    typeof a.name === "string" &&
    Array.isArray(a.lavorazioni) &&
    Array.isArray(a.luoghi)
  );
}

export function cacheOptions(opts: EntryOptions): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(opts));
  } catch {
    // ignore (private mode / quota)
  }
}

export function readCachedOptions(): EntryOptions | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EntryOptions>;
    if (parsed && Array.isArray(parsed.areas) && parsed.areas.every(isAreaOptions)) {
      return { areas: parsed.areas };
    }
    return null;
  } catch {
    return null;
  }
}
