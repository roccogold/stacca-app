import { AppShell } from "@/components/AppShell";
import { requireUserWithRole } from "@/lib/auth";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUserWithRole();

  return (
    <AppShell userId={user.id} isAdmin={user.role === "admin"}>
      {children}
    </AppShell>
  );
}
