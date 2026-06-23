"use client";

import { useEffect, useState } from "react";

type Variant = "A" | "B" | "C";
const VARIANTS: Variant[] = ["A", "B", "C"];

const COPY: Record<
  Variant,
  { eyebrow: string; headline: string; sub: string; bullets: string[] }
> = {
  A: {
    eyebrow: "For globally-mobile & international-school families",
    headline: "One program that moves with your family.",
    sub: "US Common Core, the UK National Curriculum, or Singapore Math — Astute Academy keeps your child on track in every system, so moving countries never means starting over.",
    bullets: [
      "See where your child stands in all three curricula at once",
      "Placement and progress that follow them across borders",
      "A clear month-by-month path, not random drilling",
    ],
  },
  B: {
    eyebrow: "Math & reading that actually teach",
    headline: "Rigorous learning your kid can’t game.",
    sub: "A calm, mastery-based path: a short lesson, then practice until your child truly gets it. You set the standard — no ads, no gimmicks, no pay-to-win.",
    bullets: [
      "Master each skill before moving on — you set the pass bar",
      "Every wrong answer explained in kid-friendly language",
      "No ads, no dark patterns, no in-game upsells",
    ],
  },
  C: {
    eyebrow: "Your child’s whole school year, planned",
    headline: "The full curriculum, week by week, Sept to June.",
    sub: "A complete, grade-aligned plan for the year — math and reading laid out week by week so you always know your child is covering everything, and exactly where they are.",
    bullets: [
      "Every week mapped out from September to June",
      "See the curriculum is fully covered — no gaps",
      "Lessons then practice, mastery-gated, at your child’s pace",
    ],
  },
};

const SITUATIONS = [
  { v: "", label: "Your situation (optional)" },
  { v: "expat", label: "Expat / relocating family" },
  { v: "international", label: "International-school family" },
  { v: "homeschool", label: "Homeschool" },
  { v: "local", label: "Local school" },
  { v: "other", label: "Just curious" },
];

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 180}`;
}

const BrandMark = () => (
  <svg width="30" height="30" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <rect width="28" height="28" rx="8" fill="#1d9e75" />
    <text x="12.5" y="20.5" fontFamily="Verdana, Geneva, system-ui, sans-serif" fontSize="18" fontWeight="bold" fill="#fff" textAnchor="middle">A</text>
    <text x="21.5" y="11.5" fontFamily="Verdana, Geneva, system-ui, sans-serif" fontSize="10" fontWeight="bold" fill="#fff" textAnchor="middle">+</text>
  </svg>
);

export default function EarlyLanding() {
  const [variant, setVariant] = useState<Variant | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [email, setEmail] = useState("");
  const [situation, setSituation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let sid = readCookie("kareem_sid");
    if (!sid) {
      sid = crypto.randomUUID();
      writeCookie("kareem_sid", sid);
    }
    let v = readCookie("kareem_ab") as Variant | null;
    if (!v || !VARIANTS.includes(v)) {
      v = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
      writeCookie("kareem_ab", v);
    }
    setSessionId(sid);
    setVariant(v);
    fetch("/api/landing-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sid, variant: v }),
    }).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!variant) return;
    setBusy(true);
    setErr(null);
    const r = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, variant, situation, sessionId }),
    });
    setBusy(false);
    if (!r.ok) return setErr("Hmm, that didn’t go through. Check the email and try again.");
    setDone(true);
  }

  if (!variant) return null;
  const c = COPY[variant];

  return (
    <div className="early-wrap">
      <div className="early-card">
        <div className="early-brand">
          <BrandMark />
          <span>Astute Academy</span>
        </div>

        {done ? (
          <div className="early-done">
            <h1>You’re on the list 🎉</h1>
            <p className="sub">
              Thanks! We’ll email you when early access opens. Tell a friend who’d want this.
            </p>
          </div>
        ) : (
          <>
            <div className="early-eyebrow">{c.eyebrow}</div>
            <h1 className="early-headline">{c.headline}</h1>
            <p className="early-sub">{c.sub}</p>
            <ul className="early-bullets">
              {c.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <form className="early-form" onSubmit={submit}>
              <input
                type="email"
                required
                value={email}
                placeholder="you@email.com"
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
              />
              <select value={situation} onChange={(e) => setSituation(e.target.value)}>
                {SITUATIONS.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.label}
                  </option>
                ))}
              </select>
              <button className="btn" type="submit" disabled={busy || !email}>
                {busy ? "…" : "Join the early list"}
              </button>
              {err && <p className="err">{err}</p>}
              <p className="early-fine">Free to join. No spam — just a note when we open.</p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
