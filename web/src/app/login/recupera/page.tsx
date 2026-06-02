import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { StaccaLogo } from "@/components/StaccaLogo";
import { getSession } from "@/lib/get-session";
import { redirect } from "next/navigation";

export default async function RecuperaPasswordPage() {
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
        <h1 className="login-page__title">Recupera password</h1>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
