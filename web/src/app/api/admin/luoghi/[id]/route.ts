import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { adminRateLimited } from "@/lib/admin-rate-limit";
import { parseLuogoInput } from "@/lib/admin-options";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const limited = adminRateLimited(req);
  if (limited) return limited;

  const { id } = await ctx.params;
  const target = await prisma.luogo.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Luogo non trovato" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = parseLuogoInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const area = await prisma.area.findUnique({
    where: { id: parsed.areaId },
    select: { id: true },
  });
  if (!area) {
    return NextResponse.json({ error: "Settore non valido" }, { status: 400 });
  }

  const dupe = await prisma.luogo.findFirst({
    where: {
      areaId: parsed.areaId,
      name: { equals: parsed.name, mode: "insensitive" },
      id: { not: id },
    },
    select: { id: true },
  });
  if (dupe) {
    return NextResponse.json(
      { error: "Esiste già un luogo con questo nome in quest'area." },
      { status: 409 },
    );
  }

  const luogo = await prisma.luogo.update({
    where: { id },
    data: { name: parsed.name, areaId: parsed.areaId },
  });
  return NextResponse.json({ luogo });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const limited = adminRateLimited(req);
  if (limited) return limited;

  const { id } = await ctx.params;
  const target = await prisma.luogo.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Luogo non trovato" }, { status: 404 });
  }

  // Safe hard delete: TimeEntry stores the name as a string, so removing the
  // option here never touches historical entries — it just stops being offered.
  await prisma.luogo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
