import { prisma } from "@/lib/prisma";
import { RESERVED_OPTION } from "@/lib/constants";

export { RESERVED_OPTION };

export type LuogoCategory = "vigne" | "altro";

const MAX_NAME = 60;

export type ParsedLavorazioneInput = { name: string } | { error: string };
export type ParsedLuogoInput =
  | { name: string; category: LuogoCategory }
  | { error: string };

/**
 * Capitalize the first letter of every word, leaving the rest as typed (so
 * acronyms like "VDM", "SG", "F9" survive). "vigna vecchia" → "Vigna Vecchia",
 * "vigna grande nuova (tre borri)" → "Vigna Grande Nuova (Tre Borri)".
 */
export function toTitleCase(input: string): string {
  return input.replace(
    /(^|[\s('’\-/])(\p{L})/gu,
    (_, sep: string, ch: string) => sep + ch.toUpperCase(),
  );
}

function cleanName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return toTitleCase(raw.trim().replace(/\s+/g, " "));
}

function validateName(name: string): string | null {
  if (!name) return "Il nome è obbligatorio";
  if (name.length > MAX_NAME) return `Massimo ${MAX_NAME} caratteri`;
  if (name.toLowerCase() === RESERVED_OPTION.toLowerCase()) {
    return `"${RESERVED_OPTION}" è una voce fissa: non serve aggiungerla.`;
  }
  return null;
}

export function parseLavorazioneInput(body: unknown): ParsedLavorazioneInput {
  if (typeof body !== "object" || body === null) return { error: "Dati non validi" };
  const name = cleanName((body as Record<string, unknown>).name);
  const err = validateName(name);
  return err ? { error: err } : { name };
}

export function parseLuogoInput(body: unknown): ParsedLuogoInput {
  if (typeof body !== "object" || body === null) return { error: "Dati non validi" };
  const b = body as Record<string, unknown>;
  const name = cleanName(b.name);
  const err = validateName(name);
  if (err) return { error: err };
  if (b.category !== "vigne" && b.category !== "altro") {
    return { error: "Categoria non valida" };
  }
  return { name, category: b.category };
}

/** Active (non-archived) lavorazione names plus the reserved "Altro". */
export async function getActiveLavorazioneNames(): Promise<Set<string>> {
  const rows = await prisma.lavorazione.findMany({
    where: { archived: false },
    select: { name: true },
  });
  const set = new Set(rows.map((r) => r.name));
  set.add(RESERVED_OPTION);
  return set;
}

/** Active (non-archived) luogo names plus the reserved "Altro". */
export async function getActiveLuogoNames(): Promise<Set<string>> {
  const rows = await prisma.luogo.findMany({
    where: { archived: false },
    select: { name: true },
  });
  const set = new Set(rows.map((r) => r.name));
  set.add(RESERVED_OPTION);
  return set;
}
