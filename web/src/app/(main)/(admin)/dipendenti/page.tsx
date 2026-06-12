import { DipendentiClient } from "@/components/DipendentiClient";
import { requireAdmin } from "@/lib/auth";
import { getProtectedAdminEmail } from "@/lib/admin-users";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DipendentiPage() {
  const me = await requireAdmin();
  const protectedEmail = getProtectedAdminEmail();

  const [rows, areas] = await Promise.all([
    prisma.user.findMany({
      where: { archived: false },
      orderBy: [{ role: "asc" }, { firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        role: true,
        disabled: true,
        mustChangePassword: true,
        createdAt: true,
        areas: { select: { areaId: true } },
      },
    }),
    prisma.area.findMany({
      where: { archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const initialUsers = rows.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    displayName: u.displayName,
    email: u.email,
    role: u.role,
    disabled: u.disabled,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt.toISOString(),
    protected: (u.email ?? "").trim().toLowerCase() === protectedEmail,
    areaIds: u.areas.map((a) => a.areaId),
  }));

  const currentUserIsProtected =
    initialUsers.find((u) => u.id === me.id)?.protected ?? false;

  return (
    <DipendentiClient
      currentUserId={me.id}
      currentUserIsProtected={currentUserIsProtected}
      initialUsers={initialUsers}
      areas={areas}
    />
  );
}
