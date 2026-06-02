import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/get-session";

export async function requireLoggedIn() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) {
    redirect("/login");
  }
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });
  if (!user) {
    session.destroy();
    await session.save();
    redirect("/login");
  }
  return user;
}

export async function requireUser() {
  const user = await requireLoggedIn();
  if (user.mustChangePassword) {
    redirect("/login/nuova-password");
  }
  return user;
}

export async function optionalUser() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) return null;
  return prisma.user.findUnique({ where: { id: session.userId } });
}
