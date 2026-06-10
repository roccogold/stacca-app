/**
 * Client-side cache of the entry-form option lists so the form stays usable
 * offline. Lists here never include the reserved "Altro" (appended in the UI).
 */
export type EntryOptions = {
  mansioni: string[];
  luoghiVigne: string[];
  luoghiAltro: string[];
};

const KEY = "stacca-entry-options-v1";

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
    if (
      parsed &&
      Array.isArray(parsed.mansioni) &&
      Array.isArray(parsed.luoghiVigne) &&
      Array.isArray(parsed.luoghiAltro)
    ) {
      return {
        mansioni: parsed.mansioni,
        luoghiVigne: parsed.luoghiVigne,
        luoghiAltro: parsed.luoghiAltro,
      };
    }
    return null;
  } catch {
    return null;
  }
}
