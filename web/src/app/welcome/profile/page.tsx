import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WelcomeProfileForm } from "./WelcomeProfileForm";

export const dynamic = "force-dynamic";

export default async function WelcomeProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("parents").select("full_name").eq("id", user.id).maybeSingle();

  return (
    <div className="wrap">
      <div className="card">
        <p className="muted" style={{ fontSize: "0.8rem" }}>Step 1 of 2</p>
        <h1>Welcome — tell us about you</h1>
        <p className="sub">
          This helps with receipts and keeping your account secure. You can skip and add it later.
        </p>
        <WelcomeProfileForm defaultName={data?.full_name ?? ""} />
      </div>
    </div>
  );
}
