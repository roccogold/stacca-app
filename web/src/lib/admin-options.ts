import { prisma } from "@/lib/prisma";
import { RESERVED_OPTION } from "@/lib/constants";

export { RESERVED_OPTION };

const MAX_NAME = 60;

export type ParsedAreaInput = { name: string } | { error: string };
export type ParsedCatalogInput =
  | { name: string; areaId: string }
  | { error: string };

/**
 * Capitalize the first letter of every word, leaving the rest as typed (so
 * acronyms like "VDM", "SG", "F9" survive). "vigna vecchia" → "Vigna Vecchia".
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

function lengthError(name: string): string | null {
  if (!name) return "Il nome è obbligatorio";
  if (name.length > MAX_NAME) return `Massimo ${MAX_NAME} caratteri`;
  return null;
}

function reservedError(name: string): string | null {
  if (name.toLowerCase() === RESERVED_OPTION.toLowerCase()) {
    return `"${RESERVED_OPTION}" è una voce fissa: non serve aggiungerla.`;
  }
  return null;
}

/** Area: just a name. */
export function parseAreaInput(body: unknown): ParsedAreaInput {
  if (typeof body !== "object" || body === null) return { error: "Dati non validi" };
  const name = cleanName((body as Record<string, unknown>).name);
  const err = lengthError(name);
  return err ? { error: err } : { name };
}

/** Lavorazione / Luogo: a name + the area it belongs to. */
function parseCatalogInput(body: unknown): ParsedCatalogInput {
  if (typeof body !== "object" || body === null) return { error: "Dati non validi" };
  const b = body as Record<string, unknown>;
  const name = cleanName(b.name);
  const err = lengthError(name) ?? reservedError(name);
  if (err) return { error: err };
  const areaId = typeof b.areaId === "string" ? b.areaId.trim() : "";
  if (!areaId) return { error: "Seleziona un settore" };
  return { name, areaId };
}

export const parseLavorazioneInput = parseCatalogInput;
export const parseLuogoInput = parseCatalogInput;

/** Area names assigned to the user (non-archived areas), for entry validation. */
export async function getUserAreaNames(userId: string): Promise<Set<string>> {
  const rows = await prisma.userArea.findMany({
    where: { userId },
    select: { area: { select: { name: true, archived: true } } },
  });
  return new Set(rows.filter((r) => !r.area.archived).map((r) => r.area.name));
}

/**
 * Active lavorazione + luogo names for a given area (by area name), each plus
 * the reserved "Altro". Returns null if the area doesn't exist.
 */
export async function getAreaOptionNames(
  areaName: string,
): Promise<{ lavorazioni: Set<string>; luoghi: Set<string> } | null> {
  const area = await prisma.area.findUnique({
    where: { name: areaName },
    select: { id: true },
  });
  if (!area) return null;

  const [lav, luo] = await Promise.all([
    prisma.lavorazione.findMany({
      where: { areaId: area.id, archived: false },
      select: { name: true },
    }),
    prisma.luogo.findMany({
      where: { areaId: area.id, archived: false },
      select: { name: true },
    }),
  ]);

  const lavorazioni = new Set(lav.map((r) => r.name));
  lavorazioni.add(RESERVED_OPTION);
  const luoghi = new Set(luo.map((r) => r.name));
  luoghi.add(RESERVED_OPTION);
  return { lavorazioni, luoghi };
}
