import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { adminRateLimited } from "@/lib/admin-rate-limit";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const limited = adminRateLimited(req);
  if (limited) return limited;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }
  const archived =
    typeof body === "object" && body !== null
      ? (body as { archived?: unknown }).archived
      : undefined;
  if (typeof archived !== "boolean") {
    return NextResponse.json({ error: "Campo 'archived' mancante" }, { status: 400 });
  }

  const target = await prisma.lavorazione.findUnique({ where: { id }, select: { id: true } });
  if (!target) {
    return NextResponse.json({ error: "Lavorazione non trovata" }, { status: 404 });
  }

  const lavorazione = await prisma.lavorazione.update({
    where: { id },
    data: { archived },
  });
  return NextResponse.json({ lavorazione });
}
