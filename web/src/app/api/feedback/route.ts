import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getFeedbackToEmail, sendEmail } from "@/lib/email";
import { sessionOptions, type SessionData } from "@/lib/session";

const MAX_LEN = 4000;

export async function POST(req: Request) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Accedi per inviare feedback" }, { status: 401 });
  }

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON non valido" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message || message.length < 3) {
    return NextResponse.json(
      { error: "Scrivi almeno qualche parola." },
      { status: 400 },
    );
  }
  if (message.length > MAX_LEN) {
    return NextResponse.json({ error: "Messaggio troppo lungo." }, { status: 400 });
  }

  const to = getFeedbackToEmail();
  const sent = await sendEmail({
    to,
    subject: `[Stacca] Feedback da ${session.displayName || session.handle}`,
    text: [
      `Utente: ${session.displayName} (@${session.handle})`,
      `User id: ${session.userId}`,
      `Data invio: ${new Date().toISOString()}`,
      "",
      message,
    ].join("\n"),
  });

  if (!sent.ok) {
    return NextResponse.json({ error: sent.error }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
