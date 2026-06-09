import nodemailer from "nodemailer";
import { logError } from "@/lib/log-error";

/** SMTP transport (e.g. Gmail). Active only when host/user/pass are all set. */
function getSmtpTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  // Gmail App Passwords are shown in groups of 4 with spaces — strip all whitespace.
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, "");
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT) || 587;
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user, pass },
  });
}

/** Sender must be the authenticated mailbox (Gmail won't spoof another address). */
function getSmtpFrom() {
  return process.env.SMTP_FROM?.trim() || process.env.SMTP_USER?.trim() || "";
}

export function getFeedbackToEmail() {
  return process.env.FEEDBACK_TO_EMAIL?.trim() || "roccogold23@gmail.com";
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const transport = getSmtpTransport();
  if (!transport) {
    return {
      ok: false,
      error:
        "Invio email non configurato. Imposta le variabili SMTP_* nel file .env (vedi .env.example).",
    };
  }

  try {
    await transport.sendMail({
      from: `Stacca <${getSmtpFrom()}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
    });
    return { ok: true };
  } catch (error) {
    logError("email-smtp", error);
    return { ok: false, error: "Errore nell'invio. Riprova più tardi." };
  }
}
