import { AppFooter } from "@/components/AppFooter";
import { StaccaLogo } from "@/components/StaccaLogo";
import { LoginForm } from "@/components/LoginForm";
import { getSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function LoginPage() {
  const session = await getSession();
  if (session.isLoggedIn && session.userId) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user) {
      redirect("/api/auth/logout");
    }
    if (user.mustChangePassword) {
      redirect("/login/nuova-password");
    }
    redirect("/");
  }

  return (
    <div className="no-nav login-page">
      <div className="login-page__inner">
        <div className="login-brand">
          <StaccaLogo size={64} linked={false} variant="stacked" />
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
      <AppFooter />
    </div>
  );
}
