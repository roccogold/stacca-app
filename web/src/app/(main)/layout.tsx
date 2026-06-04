import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return <AppShell userId={user.id}>{children}</AppShell>;
}
