import { ProfiloClient } from "@/components/ProfiloClient";
import { requireUser } from "@/lib/auth";

export default async function ProfiloPage() {
  const user = await requireUser();
  const firstName = user.displayName.split(" ")[0] || user.displayName;

  return <ProfiloClient firstName={firstName} />;
}
