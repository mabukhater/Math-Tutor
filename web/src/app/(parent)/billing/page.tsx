import { createClient } from "@/lib/supabase/server";
import { BillingControl } from "@/components/BillingControl";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: billing } = await supabase
    .from("parents")
    .select("subscription_plan, subscription_status, subscription_subject")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Billing &amp; plan</h1>
      <BillingControl
        plan={billing?.subscription_plan ?? "free"}
        status={billing?.subscription_status ?? null}
        subject={billing?.subscription_subject ?? null}
      />
      <p className="muted" style={{ marginTop: "1.5rem" }}>
        Your first child is included on any paid plan; each additional child is{" "}
        <strong>$3/month</strong>. Manage or cancel anytime via Manage billing above.
      </p>
    </>
  );
}
