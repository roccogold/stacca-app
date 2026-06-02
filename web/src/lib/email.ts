import { Resend } from "resend";

export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

export function getFromAddress() {
  return process.env.EMAIL_FROM || process.env.FEEDBACK_FROM_EMAIL || "onboarding@resend.dev";
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const resend = getResendClient();
  if (!resend) {
    return {
      ok: false,
      error:
        "Invio email non configurato. Imposta RESEND_API_KEY nel file .env (vedi .env.example).",
    };
  }

  const { error } = await resend.emails.send({
    from: `Stacca <${getFromAddress()}>`,
    to: [opts.to],
    subject: opts.subject,
    text: opts.text,
  });

  if (error) {
    console.error("[email]", error);
    return { ok: false, error: "Errore nell'invio. Riprova più tardi." };
  }

  return { ok: true };
}
