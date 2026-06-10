import { AdminTabs } from "@/components/AdminTabs";
import { requireAdmin } from "@/lib/auth";

/**
 * Shared shell for the admin hub (Dipendenti / Lavorazioni / Luoghi).
 * Guards once with requireAdmin() and renders the segmented sub-navigation.
 * Route groups don't affect the URL, so paths stay /dipendenti, /lavorazioni,
 * /luoghi.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <>
      <AdminTabs />
      {children}
    </>
  );
}
