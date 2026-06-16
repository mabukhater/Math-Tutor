"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMsg(error.message);
    router.refresh();
    router.push("/dashboard");
  }

  async function signUp() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setMsg(error.message);
    if (data.session) {
      router.refresh();
      router.push("/dashboard");
    } else {
      setMsg("Account created. Check your email to confirm, then sign in.");
    }
  }

  return (
    <div className="wrap">
      <div className="card">
        <h1>Welcome</h1>
        <p className="sub">Sign in, or create a parent account.</p>
        <label>Email</label>
        <input
          type="email"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
        />
        <label>Password</label>
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn" disabled={busy || !email || !password} onClick={signIn}>
          Sign in
        </button>
        <button
          className="btn btn-ghost"
          disabled={busy || !email || !password}
          onClick={signUp}
        >
          Create account
        </button>
        {msg && <p className="err">{msg}</p>}
      </div>
    </div>
  );
}
