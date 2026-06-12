import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { adminRateLimited } from "@/lib/admin-rate-limit";
import { parseAreaInput } from "@/lib/admin-options";

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const aree = await prisma.area.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ aree });
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

  const parsed = parseAreaInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const dupe = await prisma.area.findFirst({
    where: { name: { equals: parsed.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (dupe) {
    return NextResponse.json(
      { error: "Esiste già un settore con questo nome." },
      { status: 409 },
    );
  }

  const area = await prisma.area.create({ data: { name: parsed.name } });
  return NextResponse.json({ area }, { status: 201 });
}
