import { StaccaLogo } from "@/components/StaccaLogo";
import { LoginForm } from "@/components/LoginForm";
import { getSession } from "@/lib/get-session";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await getSession();
  if (session.isLoggedIn) {
    redirect("/");
  }

  return (
    <div className="no-nav login-page">
      <div className="login-page__inner">
        <div className="login-brand">
          <StaccaLogo size={64} linked={false} variant="stacked" />
        </div>
        <div className="login-brand__text">
          <h1 className="login-brand__hello">Ciao!</h1>
          <p className="login-brand__tag">Apri il tuo diario delle ore.</p>
        </div>
        <LoginForm />
        <p className="login-footer">Hai dimenticato la password? Chiedi all&apos;admin.</p>
      </div>
    </div>
  );
}
