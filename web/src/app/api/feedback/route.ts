import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { Resend } from "resend";
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

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_TO_EMAIL;
  const from = process.env.FEEDBACK_FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey || !to) {
    return NextResponse.json(
      {
        error:
          "Invio email non configurato. Imposta RESEND_API_KEY e FEEDBACK_TO_EMAIL nel file .env (vedi .env.example).",
      },
      { status: 503 },
    );
  }

  const resend = new Resend(apiKey);
  const subject = `[Stacca] Feedback da ${session.displayName || session.handle}`;
  const text = [
    `Utente: ${session.displayName} (@${session.handle})`,
    `User id: ${session.userId}`,
    `Data invio: ${new Date().toISOString()}`,
    "",
    message,
  ].join("\n");

  const { error } = await resend.emails.send({
    from: `Stacca <${from}>`,
    to: [to],
    subject,
    text,
  });

  if (error) {
    console.error("[feedback]", error);
    return NextResponse.json(
      { error: "Errore nell'invio. Riprova più tardi." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
