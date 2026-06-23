import Stripe from "stripe";

// Lazy server-only Stripe client. Instantiated on first use (at request time),
// NOT at module load — so the build doesn't fail when STRIPE_SECRET_KEY is unset.
let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export type Plan = "one" | "all";

// Plan -> Stripe recurring price id (created in the Stripe dashboard, then set
// as env vars). Until they're set, checkout returns a clear error.
export function priceForPlan(plan: Plan): string | undefined {
  return plan === "all" ? process.env.STRIPE_PRICE_ALL : process.env.STRIPE_PRICE_ONE;
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://astute.academy";
