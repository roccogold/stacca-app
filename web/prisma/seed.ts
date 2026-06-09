import { PrismaClient, UserRole } from "@prisma/client";
import { demoPasswordForHandle, hashSecret } from "../src/lib/password";
import { WORKERS } from "./workers.local";

const prisma = new PrismaClient();

async function main() {
  for (const w of WORKERS) {
    const password = demoPasswordForHandle(w.handle, w.suffix);
    const passwordHash = await hashSecret(password);
    const email = w.email.toLowerCase();
    const displayName = `${w.firstName} ${w.lastName}`.trim();
    const role: UserRole =
      "role" in w && w.role === "admin" ? UserRole.admin : UserRole.dipendente;

    const existing = await prisma.user.findUnique({ where: { handle: w.handle } });

    if (existing) {
      await prisma.user.update({
        where: { handle: w.handle },
        data: {
          displayName,
          firstName: w.firstName,
          lastName: w.lastName,
          role,
          email,
        },
      });
      console.log(`✓ ${displayName} — ${email} — ${role} — aggiornato (password invariata)`);
      continue;
    }

    await prisma.user.create({
      data: {
        handle: w.handle,
        displayName,
        firstName: w.firstName,
        lastName: w.lastName,
        role,
        email,
        passwordHash,
        mustChangePassword: true,
      },
    });
    console.log(`✓ ${displayName} — ${email} — ${role} — nuovo — demo: ${password}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
