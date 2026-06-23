import { NextResponse } from "next/server";

// Temporary diagnostic: reports which Stripe env vars the app can see (booleans
// only — never the values). Used to debug deploy/variable issues; safe to remove.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: !!process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_ONE: !!process.env.STRIPE_PRICE_ONE,
    STRIPE_PRICE_ALL: !!process.env.STRIPE_PRICE_ALL,
  });
}
