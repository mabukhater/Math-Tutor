import { createClient } from "@/lib/supabase/server";
import type { ParentProfile } from "@/lib/profileActions";
import { ProfileSection } from "./ProfileSection";
import { PasswordForm } from "./PasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("parents")
    .select("full_name, address_line1, address_line2, city, region, postal_code, country, phone")
    .eq("id", user.id)
    .maybeSingle();

  const profile: ParentProfile = {
    full_name: data?.full_name ?? null,
    address_line1: data?.address_line1 ?? null,
    address_line2: data?.address_line2 ?? null,
    city: data?.city ?? null,
    region: data?.region ?? null,
    postal_code: data?.postal_code ?? null,
    country: data?.country ?? null,
    phone: data?.phone ?? null,
  };

  return (
    <>
      <h1 style={{ marginTop: 0 }}>Account</h1>
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.05rem" }}>Profile</h2>
        <ProfileSection profile={profile} email={user.email ?? ""} />
      </section>
      <section>
        <h2 style={{ fontSize: "1.05rem" }}>Password</h2>
        <PasswordForm />
      </section>
    </>
  );
}
