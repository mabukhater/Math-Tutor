import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { Check } from "@/components/icons";

export const metadata: Metadata = {
  title: "Pricing — Kareem",
  description: "Simple plans: a free taste, one subject for $4.99/mo, or every subject for $7.99/mo.",
};

interface Tier {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: string;
  featured?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Free",
    price: "$0",
    cadence: "",
    blurb: "Get a feel for it.",
    features: ["10 practice questions", "Adaptive placement check", "One child profile"],
    cta: "Start free",
  },
  {
    name: "One Subject",
    price: "$4.99",
    cadence: "/month",
    blurb: "Daily practice in one subject.",
    features: [
      "Unlimited daily practice in one subject",
      "Math available now — more subjects coming",
      "Full adaptive placement",
      "Spaced-repetition review",
      "Parent dashboard & mastery map",
      "Multiple children",
    ],
    cta: "Choose One Subject",
  },
  {
    name: "All Subjects",
    price: "$7.99",
    cadence: "/month",
    blurb: "Everything, every subject.",
    features: [
      "Everything in One Subject",
      "All subjects, as we add them",
      "Cross-curriculum level tracking",
      "Priority access to new features",
    ],
    cta: "Choose All Subjects",
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
              <Link href="/login" className={t.featured ? "btn-cta" : "btn-soft"} style={{ width: "100%", justifyContent: "center" }}>
                {t.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="muted" style={{ marginTop: "1.5rem" }}>
          We&apos;re in early access, so plans and billing may evolve. Early families keep
          early-access perks.
        </p>
      </div>
    </MarketingShell>
  );
}
