import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { CheckoutButton } from "@/components/CheckoutButton";
import { Check } from "@/components/icons";
import { PRICING } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing — Astute Academy",
  description: `Simple plans: a free taste, one subject for ${PRICING.one.price}/mo, or every subject for ${PRICING.all.price}/mo.`,
};

interface Tier {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: string;
  plan?: "one" | "all";
  featured?: boolean;
}

const TIERS: Tier[] = [
  {
    name: PRICING.free.label,
    price: PRICING.free.price,
    cadence: PRICING.free.cadence,
    blurb: "Get a feel for it.",
    features: ["10 practice questions", "Adaptive placement check", "One child profile"],
    cta: "Start free",
  },
  {
    name: PRICING.one.label,
    price: PRICING.one.price,
    cadence: PRICING.one.cadence,
    blurb: "Daily practice in one subject.",
    features: [
      "Unlimited daily practice in one subject",
      "Math available now — more subjects coming",
      "Full adaptive placement",
      "Spaced-repetition review",
      "Parent dashboard & mastery map",
      `First child included · add a child for ${PRICING.perChild} each`,
    ],
    cta: "Choose One Subject",
    plan: "one",
  },
  {
    name: PRICING.all.label,
    price: PRICING.all.price,
    cadence: PRICING.all.cadence,
    blurb: "Everything, every subject.",
    features: [
      "Everything in One Subject",
      "Math and Reading included",
      "Every new subject added free",
      "Cross-curriculum level tracking",
      "Switch between subjects anytime",
      "Spaced-repetition review across subjects",
      "Priority access to new features",
      `First child included · add a child for ${PRICING.perChild} each`,
    ],
    cta: "Choose All Subjects",
    plan: "all",
    featured: true,
  },
];

export default function Pricing() {
  return (
    <MarketingShell>
      <div className="content-wrap" style={{ maxWidth: 920, textAlign: "center" }}>
        <h1>Simple pricing</h1>
        <p className="sub" style={{ marginLeft: "auto", marginRight: "auto" }}>
          Start free, then pick one subject or unlock them all. Cancel anytime, and we&apos;ll
          always show pricing clearly before any charge.
        </p>

        <div className="pricing-grid">
          {TIERS.map((t) => (
            <div key={t.name} className={"tier-card" + (t.featured ? " featured" : "")}>
              {t.featured && <span className="tier-badge">Most popular</span>}
              <div className="tier-name">{t.name}</div>
              <div className="tier-price">
                {t.price}
                {t.cadence && <span className="tier-cadence">{t.cadence}</span>}
              </div>
              <p className="muted">{t.blurb}</p>
              <ul className="tier-features">
                {t.features.map((f) => (
                  <li key={f}>
                    <Check size={17} /> {f}
                  </li>
                ))}
              </ul>
              {t.plan ? (
                <CheckoutButton
                  plan={t.plan}
                  label={t.cta}
                  className={t.featured ? "btn-cta" : "btn-soft"}
                />
              ) : (
                <Link
                  href="/login"
                  className={t.featured ? "btn-cta" : "btn-soft"}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  {t.cta}
                </Link>
              )}
            </div>
          ))}
        </div>

        <p className="muted" style={{ marginTop: "1.5rem" }}>
          Got more than one child? Your first child is included on any paid plan, and each
          additional child is just <strong>{PRICING.perChild}</strong> — on either One Subject or All Subjects.
        </p>
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          We&apos;re in early access, so plans and billing may evolve. Early families keep
          early-access perks.
        </p>
      </div>
    </MarketingShell>
  );
}
