import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { Check } from "@/components/icons";

export const metadata: Metadata = {
  title: "Pricing — Math Tutor",
  description: "Simple, honest pricing. Free during early access.",
};

const INCLUDED = [
  "All three curricula — US, UK, and Singapore",
  "Adaptive placement for each child",
  "Daily curriculum-aligned practice",
  "Spaced-repetition review built in",
  "Parent dashboard with a mastery map",
  "Cross-curriculum level tracking",
  "Web now — Telegram and apps coming",
];

export default function Pricing() {
  return (
    <MarketingShell>
      <div className="content-wrap" style={{ textAlign: "center" }}>
        <h1>Simple pricing</h1>
        <p className="sub" style={{ marginLeft: "auto", marginRight: "auto" }}>
          We&apos;re in early access, so the whole thing is free while we build. Early families
          keep early-access perks.
        </p>

        <div className="price-card">
          <span className="badge">Early access</span>
          <div className="price-amount">Free</div>
          <p className="muted">Everything included, no card required.</p>
          <ul className="price-list">
            {INCLUDED.map((f) => (
              <li key={f}>
                <Check size={18} /> {f}
              </li>
            ))}
          </ul>
          <Link href="/login" className="btn-cta" style={{ marginTop: "0.5rem" }}>
            Get started
          </Link>
        </div>

        <p className="muted" style={{ marginTop: "1.5rem" }}>
          A paid family plan will arrive as we add more curricula and the mobile apps. We&apos;ll
          always be upfront about pricing before any charge.
        </p>
      </div>
    </MarketingShell>
  );
}
