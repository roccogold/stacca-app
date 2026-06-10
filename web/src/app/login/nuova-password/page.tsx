import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { StaccaLogo } from "@/components/StaccaLogo";
import { requireLoggedInSession } from "@/lib/auth";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";

export default async function NuovaPasswordPage() {
  const session = await requireLoggedInSession();
  if (!session.mustChangePassword) {
    redirect("/");
  }

  return (
    <div className="no-nav login-page">
      <div className="login-page__inner login-page__inner--with-back">
        <nav className="login-page__nav" aria-label="Navigazione">
          {/* Plain <a>, not next/link: the back arrow points at the logout GET
              endpoint, which destroys the session. A <Link> would prefetch it
              on viewport entry (in production) and silently log the user out
              before they can submit the new password. */}
          <a
            href="/api/auth/logout"
            className="btn-icon"
            aria-label="Indietro al login"
          >
            <ArrowLeft size={20} aria-hidden />
          </a>
        </nav>
        <div className="login-brand">
          <StaccaLogo size={64} linked={false} variant="stacked" />
        </div>
        <h1 className="login-page__title">Nuova password</h1>
        <ChangePasswordForm forced />
      </div>
    </div>
  );
}
