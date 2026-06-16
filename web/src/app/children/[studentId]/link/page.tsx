import Link from "next/link";

// Placeholder — the real Telegram linking flow is built in M3.
export default function LinkTelegram() {
  return (
    <div className="wrap">
      <div className="card">
        <span className="badge">Coming in the next step</span>
        <h1 style={{ marginTop: "0.75rem" }}>Telegram linking</h1>
        <p className="sub">
          The daily-practice bot and its one-tap linking flow land in milestone M3.
          Your child’s placement is saved and ready.
        </p>
        <Link href="/dashboard" className="btn">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
