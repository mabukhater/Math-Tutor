"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function KidSignIn() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/kids/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim().toLowerCase(), pin: pin.trim() }),
    });
    setBusy(false);
    if (!r.ok) return setErr("That username or PIN isn’t right. Ask your parent to check it.");
    router.refresh();
    router.push("/me");
  }

  return (
    <div className="wrap">
      <div className="card" style={{ textAlign: "center" }}>
        <h1>Hi! Let’s learn 🚀</h1>
        <p className="sub">Type your name and secret number to start.</p>
        <form onSubmit={submit} style={{ textAlign: "left" }}>
          <label htmlFor="u">Your username</label>
          <input
            id="u"
            value={username}
            autoComplete="username"
            autoCapitalize="none"
            onChange={(e) => setUsername(e.target.value)}
          />
          <label htmlFor="p">Your secret number (PIN)</label>
          <input
            id="p"
            type="password"
            inputMode="numeric"
            value={pin}
            autoComplete="current-password"
            onChange={(e) => setPin(e.target.value)}
          />
          <button className="btn" type="submit" disabled={busy || !username || !pin}>
            {busy ? "…" : "Start"}
          </button>
          {err && <p className="err">{err}</p>}
        </form>
        <p className="muted" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
          Are you a parent? <a href="/login">Sign in here</a>.
        </p>
      </div>
    </div>
  );
}
