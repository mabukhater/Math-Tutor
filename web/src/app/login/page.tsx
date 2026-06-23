"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy || !email || !password) return;
    setBusy(true);
    setMsg(null);
    setInfo(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setMsg(error.message);
      router.refresh();
      return router.push("/dashboard");
    }

    // Create account.
    const { data, error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setMsg(error.message);
    if (data.session) {
      // Email confirmation is off — they're signed in immediately; start onboarding.
      router.refresh();
      return router.push("/welcome/profile");
    }
    // Confirmation required.
    setInfo(
      "Account created. We sent a confirmation link to your email — click it, then sign in.",
    );
    setMode("signin");
  }

  return (
    <div className="wrap">
      <div className="card">
        <h1>{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="sub">
          {mode === "signin"
            ? "Sign in to your parent account."
            : "One parent account holds all your children’s progress."}
        </p>

        <form onSubmit={submit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="btn" type="submit" disabled={busy || !email || !password}>
            {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        {info && <p className="ok-msg">{info}</p>}
        {msg && <p className="err">{msg}</p>}

        <p className="sub" style={{ marginTop: "1rem", textAlign: "center" }}>
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button
            type="button"
            className="linklike"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setMsg(null);
              setInfo(null);
            }}
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
        <p className="muted" style={{ textAlign: "center", fontSize: "0.85rem" }}>
          Are you a kid? <a href="/kids">Go to kid sign-in →</a>
        </p>
      </div>
    </div>
  );
}
