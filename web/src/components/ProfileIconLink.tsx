import Link from "next/link";
import { User } from "lucide-react";

export function ProfileIconLink() {
  return (
    <Link href="/profilo" className="btn-icon btn-icon--profile" aria-label="Profilo">
      <User size={20} strokeWidth={2} />
    </Link>
  );
}
