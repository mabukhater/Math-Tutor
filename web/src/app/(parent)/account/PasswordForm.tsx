"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PasswordForm() {
  const supabase = createClient();
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return setMsg("Use at least 6 characters.");
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    setMsg(error ? error.message : "Password updated.");
    if (!error) setPw("");
  }

  return (
    <form onSubmit={submit} className="profile-form">
      <label htmlFor="new_password">New password</label>
      <input
        id="new_password"
        type="password"
        autoComplete="new-password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
      />
      <button className="btn" type="submit" disabled={busy || !pw}>
        {busy ? "…" : "Update password"}
      </button>
      {msg && <p className={msg === "Password updated." ? "ok-msg" : "err"}>{msg}</p>}
    </form>
  );
}
