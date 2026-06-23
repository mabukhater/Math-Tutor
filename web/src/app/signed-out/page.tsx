import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Signed out — Astute Academy",
  robots: { index: false },
};

export default function SignedOut() {
  return (
    <div className="wrap">
      <div className="card" style={{ textAlign: "center", maxWidth: 440 }}>
        <h1>You’re signed out 👋</h1>
        <p className="sub">See you next time!</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "1rem" }}>
          <Link href="/login" className="btn">
            Parent log in
          </Link>
          <Link href="/kids" className="btn-soft" style={{ display: "inline-block", padding: "0.85rem", borderRadius: 14, textAlign: "center", fontWeight: 700 }}>
            Kid sign in
          </Link>
          <Link href="/" className="muted" style={{ marginTop: "0.3rem" }}>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
