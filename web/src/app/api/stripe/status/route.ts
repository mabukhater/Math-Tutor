import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

// Temporary diagnostic: reports which Stripe env vars the app can see (booleans
// only — never the values) plus the secret-key MODE (test/live) by prefix. With
// ?probe=1 it actually calls Stripe with the configured key + STRIPE_PRICE_ALL
// and returns the real error, so we can see exactly why checkout fails. Safe to
// remove once billing is confirmed working.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sk = process.env.STRIPE_SECRET_KEY || "";
  const out: Record<string, unknown> = {
    STRIPE_SECRET_KEY: !!sk,
    STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_ONE: !!process.env.STRIPE_PRICE_ONE,
    STRIPE_PRICE_ALL: !!process.env.STRIPE_PRICE_ALL,
    secretKeyMode: sk.startsWith("sk_test_")
      ? "test"
      : sk.startsWith("sk_live_")
        ? "live"
        : sk.startsWith("rk_test_")
          ? "restricted_test"
          : sk.startsWith("rk_live_")
            ? "restricted_live"
            : sk
              ? "unknown_prefix"
              : "absent",
  };

  if (url.searchParams.get("probe") === "1") {
    try {
      const stripe = getStripe();
      const priceId = process.env.STRIPE_PRICE_ALL || "";
      const price = await stripe.prices.retrieve(priceId);
      out.probe = {
        ok: true,
        priceId,
        active: price.active,
        livemode: price.livemode,
        currency: price.currency,
        unit_amount: price.unit_amount,
      };
    } catch (e) {
      const err = e as { message?: string; type?: string; code?: string };
      out.probe = {
        ok: false,
        message: err?.message ?? String(e),
        type: err?.type,
        code: err?.code,
      };
    }
  }

  return NextResponse.json(out);
}
