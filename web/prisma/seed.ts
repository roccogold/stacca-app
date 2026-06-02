import { PrismaClient } from "@prisma/client";
import { demoPasswordForHandle, hashSecret } from "../src/lib/password";

const prisma = new PrismaClient();

/**
 * Dipendenti — modifica email e suffix prima del deploy.
 * Password demo: {handle}-{suffix}
 */
const WORKERS: {
  handle: string;
  displayName: string;
  email: string;
  suffix: string;
}[] = [
  {
    handle: "rocco",
    displayName: "Rocco",
    email: "roccogold23@gmail.com",
    suffix: "847392651",
  },
  // { handle: "marco", displayName: "Marco", email: "marco@...", suffix: "XXXXXXXXX" },
];

async function main() {
  for (const w of WORKERS) {
    const password = demoPasswordForHandle(w.handle, w.suffix);
    const passwordHash = await hashSecret(password);
    await prisma.user.upsert({
      where: { handle: w.handle },
      create: {
        handle: w.handle,
        displayName: w.displayName,
        email: w.email.toLowerCase(),
        passwordHash,
        mustChangePassword: true,
      },
      update: {
        displayName: w.displayName,
        email: w.email.toLowerCase(),
        passwordHash,
        mustChangePassword: true,
        resetCodeHash: null,
        resetCodeExpiresAt: null,
      },
    });
    console.log(`✓ ${w.displayName} — ${w.email} — demo: ${password}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
