import { DipendentiClient } from "@/components/DipendentiClient";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DipendentiPage() {
  const me = await requireAdmin();

  const rows = await prisma.user.findMany({
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
    },
  });

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
  }));

  return (
    <DipendentiClient currentUserId={me.id} initialUsers={initialUsers} />
  );
}
