import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureParent } from "@/lib/parents";
import { getStripe, priceForPlan, SITE_URL, type Plan } from "@/lib/stripe";

// Start a subscription: create (or reuse) the Stripe customer and open a hosted
// Checkout session for the chosen plan.
export async function POST(req: Request) {
  const { plan } = await req.json();
  if (plan !== "one" && plan !== "all")
    return NextResponse.json({ error: "bad plan" }, { status: 400 });
  const price = priceForPlan(plan as Plan);
  if (!price)
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "billing_not_configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  await ensureParent(supabase, user);

  const admin = createAdminClient();
  const { data: parent } = await admin
    .from("parents")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  let customerId = parent?.stripe_customer_id as string | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { parent_id: user.id },
    });
    customerId = customer.id;
    await admin.from("parents").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${SITE_URL}/dashboard?sub=success`,
    cancel_url: `${SITE_URL}/pricing?sub=cancelled`,
    metadata: { parent_id: user.id, plan },
    subscription_data: { metadata: { parent_id: user.id, plan } },
  });
  return NextResponse.json({ url: session.url });
}
