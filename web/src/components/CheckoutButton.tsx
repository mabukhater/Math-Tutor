"use client";

import { useState } from "react";

export function CheckoutButton({
  plan,
  label,
  className,
}: {
  plan: "one" | "all";
  label: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    try {
      const r = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (r.status === 401) {
        window.location.href = "/login";
        return;
      }
      const d = await r.json();
      if (d.url) {
        window.location.href = d.url;
        return;
      }
      alert(
        d.error === "billing_not_configured"
          ? "Billing isn’t switched on yet — check back soon."
          : "Couldn’t start checkout. Please try again.",
      );
    } catch {
      alert("Couldn’t start checkout. Please try again.");
    }
    setLoading(false);
  }

  return (
    <button
      onClick={go}
      disabled={loading}
      className={className}
      style={{ width: "100%", justifyContent: "center" }}
    >
      {loading ? "Loading…" : label}
    </button>
  );
}
