import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { generateTemporaryPassword, hashSecret } from "@/lib/password";
import {
  buildDisplayName,
  generateUniqueHandle,
  parseUserInput,
} from "@/lib/admin-users";

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  displayName: true,
  email: true,
  role: true,
  disabled: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

function rateLimited(req: Request) {
  const rl = checkRateLimit(
    rateLimitKey(req, "admin"),
    RATE_LIMITS.admin.limit,
    RATE_LIMITS.admin.windowMs,
  );
  if (rl.ok) return null;
  return NextResponse.json(
    { error: "Troppe richieste. Riprova tra poco." },
    { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
  );
}

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { firstName: "asc" }, { lastName: "asc" }],
    select: userSelect,
  });
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const limited = rateLimited(req);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const parsed = parseUserInput(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { firstName, lastName, email, role } = parsed;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Esiste già un utente con questa email." },
      { status: 409 },
    );
  }

  const handle = await generateUniqueHandle(
    email.split("@")[0] || `${firstName}${lastName}`,
  );
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashSecret(temporaryPassword);

  const user = await prisma.user.create({
    data: {
      handle,
      firstName,
      lastName,
      displayName: buildDisplayName(firstName, lastName),
      role,
      email,
      passwordHash,
      mustChangePassword: true,
    },
    select: userSelect,
  });

  // temporaryPassword is returned once — never stored or shown again.
  return NextResponse.json({ user, temporaryPassword }, { status: 201 });
}
