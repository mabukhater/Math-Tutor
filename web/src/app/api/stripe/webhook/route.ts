import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe -> our DB sync. Verifies the signature against the raw body, then keeps
// parents.subscription_* in step with the subscription lifecycle.
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: "unconfigured" }, { status: 400 });

  const body = await req.text();
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  const setByCustomer = (customerId: string, fields: Record<string, unknown>) =>
    admin.from("parents").update(fields).eq("stripe_customer_id", customerId);

  function planFromSub(sub: Stripe.Subscription): "one" | "all" | null {
    const m = (sub.metadata?.plan as string) || "";
    if (m === "one" || m === "all") return m;
    const priceId = sub.items.data[0]?.price.id;
    if (priceId === process.env.STRIPE_PRICE_ALL) return "all";
    if (priceId === process.env.STRIPE_PRICE_ONE) return "one";
    return null;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const plan = (s.metadata?.plan as string) === "all" ? "all" : "one";
      await setByCustomer(s.customer as string, {
        stripe_subscription_id: s.subscription as string,
        subscription_status: "active",
        subscription_plan: plan,
        // Default the One plan to math; parent can switch it in the dashboard.
        ...(plan === "one" ? { subscription_subject: "math" } : {}),
      });
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const plan = planFromSub(sub);
      const dead = ["canceled", "unpaid", "incomplete_expired"].includes(sub.status);
      await setByCustomer(sub.customer as string, {
        subscription_status: sub.status,
        stripe_subscription_id: sub.id,
        ...(plan ? { subscription_plan: plan } : {}),
        ...(dead ? { subscription_plan: "free" } : {}),
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await setByCustomer(sub.customer as string, {
        subscription_status: "canceled",
        subscription_plan: "free",
      });
      break;
    }
  }
  return NextResponse.json({ received: true });
}
