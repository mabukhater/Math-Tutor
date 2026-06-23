"use client";

import { useState } from "react";

export function BillingControl({
  plan,
  status,
  subject,
}: {
  plan: string;
  status: string | null;
  subject: string | null;
}) {
  const active = (status === "active" || status === "trialing") && plan !== "free";
  const [subj, setSubj] = useState(subject ?? "math");
  const [busy, setBusy] = useState(false);

  async function portal() {
    setBusy(true);
    try {
      const r = await fetch("/api/stripe/portal", { method: "POST" });
      const d = await r.json();
      if (d.url) {
        window.location.href = d.url;
        return;
      }
      alert("Couldn’t open billing. Please try again.");
    } catch {
      alert("Couldn’t open billing. Please try again.");
    }
    setBusy(false);
  }

  async function pickSubject(s: "math" | "reading") {
    setSubj(s);
    await fetch("/api/billing/subject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: s }),
    });
  }

  if (!active) {
    return (
      <div className="billing-bar">
        <span>
          <strong>Free plan</strong> · one free lesson a day per subject
        </span>
        <a href="/pricing" className="subject-btn math">
          Upgrade →
        </a>
      </div>
    );
  }

  return (
    <div className="billing-bar">
      <span>
        <strong>{plan === "all" ? "All Subjects" : "One Subject"}</strong> · active
      </span>
      {plan === "one" && (
        <span className="billing-subj">
          Unlocked:
          <button
            className={"chip-toggle" + (subj === "math" ? " on" : "")}
            onClick={() => pickSubject("math")}
          >
            Math
          </button>
          <button
            className={"chip-toggle" + (subj === "reading" ? " on" : "")}
            onClick={() => pickSubject("reading")}
          >
            Reading
          </button>
        </span>
      )}
      <button className="subject-btn topics" onClick={portal} disabled={busy}>
        {busy ? "…" : "Manage billing"}
      </button>
    </div>
  );
}
