"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function KidLoginManager({
  studentId,
  username,
}: {
  studentId: string;
  username: string | null;
}) {
  const router = useRouter();
  const [savedUsername, setSavedUsername] = useState(username);
  const [open, setOpen] = useState(false);
  const [u, setU] = useState(username ?? "");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    const uname = u.trim().toLowerCase();
    const r = await fetch("/api/kids/set-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, username: uname, pin: pin.trim() }),
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
    // Saved: reflect it, collapse the form, and sync the server-rendered data.
    setSavedUsername(uname);
    setPin("");
    setOpen(false);
    router.refresh();
  }

  if (!open)
    return (
      <button className="card-action" onClick={() => setOpen(true)}>
        {savedUsername ? `Kid login: ${savedUsername} · edit` : "+ Create kid login"}
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
          Cancel
        </button>
      </div>
      {err && <p className="err">{err}</p>}
    </div>
  );
}
