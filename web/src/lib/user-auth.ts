import { prisma } from "@/lib/prisma";

export async function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return null;
  return prisma.user.findUnique({ where: { email: normalized } });
}
