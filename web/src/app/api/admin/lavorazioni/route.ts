import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { adminRateLimited } from "@/lib/admin-rate-limit";
import { parseLavorazioneInput } from "@/lib/admin-options";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const lavorazioni = await prisma.lavorazione.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ lavorazioni });
}

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const limited = adminRateLimited(req);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = parseLavorazioneInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const dupe = await prisma.lavorazione.findFirst({
    where: { name: { equals: parsed.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (dupe) {
    return NextResponse.json(
      { error: "Esiste già una lavorazione con questo nome." },
      { status: 409 },
    );
  }

  const lavorazione = await prisma.lavorazione.create({
    data: { name: parsed.name },
  });
  return NextResponse.json({ lavorazione }, { status: 201 });
}
