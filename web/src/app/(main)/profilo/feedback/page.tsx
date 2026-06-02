import Link from "next/link";
import { FeedbackForm } from "@/components/FeedbackForm";

export default function FeedbackPage() {
  return (
    <>
      <header className="app-header with-back">
        <Link href="/profilo" className="btn-icon" aria-label="Indietro">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 className="app-header__title">Feedback</h1>
        <div style={{ width: 44 }} />
      </header>
      <main className="screen" style={{ paddingTop: 20, paddingBottom: 32 }}>
        <FeedbackForm />
      </main>
    </>
  );
}
