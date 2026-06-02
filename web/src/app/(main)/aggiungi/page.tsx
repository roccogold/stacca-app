import { AggiungiForm } from "@/components/AggiungiForm";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AggiungiPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await requireUser();
  const { edit } = await searchParams;
  const initial = edit
    ? await prisma.timeEntry.findFirst({
        where: { id: edit, userId: user.id },
      })
    : null;

  return <AggiungiForm initial={initial} />;
}
