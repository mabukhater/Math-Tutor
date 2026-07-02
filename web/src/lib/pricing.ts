// Single source of truth for the prices we DISPLAY in marketing/billing copy.
// The amounts actually charged live in Stripe (see priceForPlan + STRIPE_PRICE_*
// in ./stripe.ts); keep these strings in sync with those Stripe prices. Having
// one place to change avoids the drift where the pricing page, billing page,
// and meta description quote different numbers (e.g. the $2 -> $3 add-on change).
export const PRICING = {
  free: { label: "Free", price: "$0", cadence: "" },
  one: { label: "One Subject", price: "$4.99", cadence: "/month" },
  all: { label: "All Subjects", price: "$7.99", cadence: "/month" },
  /** Add-on for each child beyond the first, on any paid plan. */
  perChild: "$3/month",
} as const;
