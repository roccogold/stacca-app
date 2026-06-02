import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { StaccaLogo } from "@/components/StaccaLogo";
import { requireLoggedIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NuovaPasswordPage() {
  const user = await requireLoggedIn();
  if (!user.mustChangePassword) {
    redirect("/");
  }

  return (
    <div className="no-nav login-page">
      <div className="login-page__inner">
        <div className="login-brand">
          <StaccaLogo size={64} linked={false} variant="stacked" />
        </div>
        <h1 className="login-page__title">Nuova password</h1>
        <ChangePasswordForm forced />
      </div>
    </div>
  );
}
