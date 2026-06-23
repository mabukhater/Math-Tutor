import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, SITE_URL } from "@/lib/stripe";

// Open the Stripe Customer Portal so a parent can update their card or cancel.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const admin = createAdminClient();
  const { data: parent } = await admin
    .from("parents")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!parent?.stripe_customer_id)
    return NextResponse.json({ error: "no_customer" }, { status: 400 });

  const session = await getStripe().billingPortal.sessions.create({
    customer: parent.stripe_customer_id as string,
    return_url: `${SITE_URL}/dashboard`,
  });
  return NextResponse.json({ url: session.url });
}
