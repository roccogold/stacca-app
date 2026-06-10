import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/auth";
import { checkRateLimit, rateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";
import { generateTemporaryPassword, hashSecret } from "@/lib/password";
import { getAppUrl, sendEmail } from "@/lib/email";
import {
  buildDisplayName,
  generateUniqueHandle,
  parseUserInput,
} from "@/lib/admin-users";

const escapeHtml = (s: string) =>
  s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));

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
    select: { id: true, archived: true },
  });
  // A *visible* account with this email is a real duplicate → reject.
  // An *archived* one is hidden from the admin list but still reserves the
  // email (unique constraint), which otherwise dead-ends "create". So instead
  // we reactivate it in place: same record, so its history (ore, mesi inviati)
  // stays linked, with fresh credentials and updated name/role.
  if (existing && !existing.archived) {
    return NextResponse.json(
      { error: "Esiste già un utente con questa email." },
      { status: 409 },
    );
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashSecret(temporaryPassword);

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          firstName,
          lastName,
          displayName: buildDisplayName(firstName, lastName),
          role,
          passwordHash,
          mustChangePassword: true,
          disabled: false,
          archived: false,
          resetCodeHash: null,
          resetCodeExpiresAt: null,
        },
        select: userSelect,
      })
    : await prisma.user.create({
        data: {
          handle: await generateUniqueHandle(
            email.split("@")[0] || `${firstName}${lastName}`,
          ),
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

  // Best-effort welcome email with the temp password. Never fail creation on it:
  // the admin still gets the password to share manually (WhatsApp).
  const appUrl = getAppUrl();
  const appLinkHtml = appUrl ? `<a href="${appUrl}">${escapeHtml(appUrl)}</a>` : "";
  const welcome = await sendEmail({
    to: email,
    subject: "Benvenuto su Stacca",
    text: [
      `Ciao ${firstName},`,
      "",
      "Benvenuto su Stacca! Abbiamo creato il tuo account per la registrazione delle ore di lavoro.",
      "",
      appUrl
        ? `Per accedere vai su ${appUrl} e usa queste credenziali:`
        : "Per accedere usa queste credenziali:",
      `Email: ${email}`,
      `Password temporanea: ${temporaryPassword}`,
      "",
      "Al primo accesso ti verrà chiesto di impostare una nuova password personale.",
      "",
      'Un consiglio: puoi installare l\'app direttamente sul telefono. Apri il sito nel browser e seleziona "Aggiungi a Home":',
      '- iPhone: tocca il tasto Condividi, poi "Aggiungi alla schermata Home".',
      '- Android: apri il menu a tre puntini, poi "Aggiungi a schermata Home".',
      "",
      "Se hai domande o problemi con l'accesso, scrivici pure.",
    ].join("\n"),
    html: [
      `<p>Ciao ${escapeHtml(firstName)},</p>`,
      "<p>Benvenuto su Stacca! Abbiamo creato il tuo account per la registrazione delle ore di lavoro.</p>",
      `<p>${appUrl ? `Per accedere vai su ${appLinkHtml} e usa queste credenziali:` : "Per accedere usa queste credenziali:"}<br>Email: <strong>${escapeHtml(email)}</strong><br>Password temporanea: <strong>${temporaryPassword}</strong></p>`,
      "<p>Al primo accesso ti verrà chiesto di impostare una nuova password personale.</p>",
      `<p>Un consiglio: puoi installare l'app direttamente sul telefono. Apri il sito nel browser e seleziona <strong>"Aggiungi a Home"</strong>:</p>`,
      '<ul><li><strong>iPhone</strong>: tocca il tasto Condividi, poi "Aggiungi alla schermata Home".</li><li><strong>Android</strong>: apri il menu a tre puntini, poi "Aggiungi a schermata Home".</li></ul>',
      "<p>Se hai domande o problemi con l'accesso, scrivici pure.</p>",
    ].join("\n"),
  });

  // temporaryPassword is returned once — never stored or shown again.
  return NextResponse.json(
    { user, temporaryPassword, emailSent: welcome.ok },
    { status: 201 },
  );
}
