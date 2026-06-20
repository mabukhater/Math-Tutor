"use client";

import { useState } from "react";

export function KidLoginManager({
  studentId,
  username,
}: {
  studentId: string;
  username: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [u, setU] = useState(username ?? "");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const r = await fetch("/api/kids/set-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, username: u.trim().toLowerCase(), pin: pin.trim() }),
    });
    setBusy(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(
        d.error === "username_taken"
          ? "That username is taken — pick another."
          : "Username must be 3–20 letters/numbers and PIN 4–8 digits.",
      );
      return;
    }
    setPin("");
    setMsg(`Saved! They sign in at /kids as “${u.trim().toLowerCase()}”.`);
  }

  if (!open)
    return (
      <button className="kid-login-toggle" onClick={() => setOpen(true)}>
        {username ? `Kid login: ${username} · edit` : "+ Create kid login"}
      </button>
    );

  return (
    <div className="kid-login-box">
      <div className="kid-login-fields">
        <input
          value={u}
          placeholder="username"
          autoCapitalize="none"
          onChange={(e) => setU(e.target.value)}
          aria-label="Kid username"
        />
        <input
          value={pin}
          placeholder="PIN (4–8 digits)"
          inputMode="numeric"
          onChange={(e) => setPin(e.target.value)}
          aria-label="Kid PIN"
        />
        <button className="badge" disabled={busy || !u || !pin} onClick={save}>
          {busy ? "…" : "Save"}
        </button>
        <button className="kid-login-toggle" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {msg && <p className="ok-msg" style={{ marginTop: "0.4rem" }}>{msg}</p>}
      {err && <p className="err">{err}</p>}
    </div>
  );
}
