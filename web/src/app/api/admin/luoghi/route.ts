import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { adminRateLimited } from "@/lib/admin-rate-limit";
import { parseLuogoInput } from "@/lib/admin-options";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const luoghi = await prisma.luogo.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ luoghi });
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

  const parsed = parseLuogoInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const dupe = await prisma.luogo.findFirst({
    where: { name: { equals: parsed.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (dupe) {
    return NextResponse.json(
      { error: "Esiste già un luogo con questo nome." },
      { status: 409 },
    );
  }

  const luogo = await prisma.luogo.create({
    data: { name: parsed.name, category: parsed.category },
  });
  return NextResponse.json({ luogo }, { status: 201 });
}
