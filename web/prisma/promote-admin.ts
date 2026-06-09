import { PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    console.error("Uso: npm run db:promote-admin -- <email>");
    console.error("Es.: npm run db:promote-admin -- cantina@corzanoepaterno.it");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Nessun utente con email "${email}". Esegui prima npm run db:seed.`);
    process.exit(1);
  }

  if (user.role === UserRole.admin) {
    console.log(`• ${user.displayName} (${email}) è già admin.`);
    return;
  }

  await prisma.user.update({
    where: { email },
    data: { role: UserRole.admin },
  });

  console.log(`✓ ${user.displayName} (${email}) promosso ad admin.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
