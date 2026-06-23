"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ParentProfile = {
  full_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
};

const FIELDS: (keyof ParentProfile)[] = [
  "full_name",
  "address_line1",
  "address_line2",
  "city",
  "region",
  "postal_code",
  "country",
  "phone",
];

export async function updateParentProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const patch: Record<string, string | null> = {};
  for (const f of FIELDS) {
    const v = String(formData.get(f) ?? "").trim();
    patch[f] = v.length ? v.slice(0, 200) : null;
  }
  await supabase.from("parents").update(patch).eq("id", user.id);

  const to = String(formData.get("redirectTo") ?? "");
  if (to.startsWith("/")) redirect(to);
}

export async function finishOnboarding() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase.from("parents").update({ onboarding_completed: true }).eq("id", user.id);
  redirect("/dashboard");
}
