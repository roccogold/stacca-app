import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { adminRateLimited } from "@/lib/admin-rate-limit";
import { parseAreaInput } from "@/lib/admin-options";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const limited = adminRateLimited(req);
  if (limited) return limited;

  const { id } = await ctx.params;
  const target = await prisma.area.findUnique({ where: { id }, select: { id: true } });
  if (!target) {
    return NextResponse.json({ error: "Settore non trovato" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = parseAreaInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const dupe = await prisma.area.findFirst({
    where: { name: { equals: parsed.name, mode: "insensitive" }, id: { not: id } },
    select: { id: true },
  });
  if (dupe) {
    return NextResponse.json(
      { error: "Esiste già un settore con questo nome." },
      { status: 409 },
    );
  }

  const area = await prisma.area.update({ where: { id }, data: { name: parsed.name } });
  await logAudit(auth.user, "area.update", area.name);
  return NextResponse.json({ area });
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
  const target = await prisma.area.findUnique({ where: { id }, select: { id: true } });
  if (!target) {
    return NextResponse.json({ error: "Settore non trovato" }, { status: 404 });
  }

  // Niente cancellazione a cascata: si può eliminare solo un'area vuota.
  const [lavorazioni, luoghi, users] = await Promise.all([
    prisma.lavorazione.count({ where: { areaId: id } }),
    prisma.luogo.count({ where: { areaId: id } }),
    prisma.userArea.count({ where: { areaId: id } }),
  ]);
  if (lavorazioni > 0 || luoghi > 0 || users > 0) {
    return NextResponse.json(
      {
        error:
          "Settore non vuoto: sposta o elimina prima lavorazioni, luoghi e dipendenti collegati.",
      },
      { status: 409 },
    );
  }

  const deleted = await prisma.area.delete({ where: { id } });
  await logAudit(auth.user, "area.delete", deleted.name);
  return NextResponse.json({ ok: true });
}
