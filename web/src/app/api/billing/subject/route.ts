import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// For the One Subject plan: choose which subject (math | reading) is unlocked.
export async function POST(req: Request) {
  const { subject } = await req.json();
  if (subject !== "math" && subject !== "reading")
    return NextResponse.json({ error: "bad subject" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const admin = createAdminClient();
  const { data: p } = await admin
    .from("parents")
    .select("subscription_plan")
    .eq("id", user.id)
    .maybeSingle();
  if (p?.subscription_plan !== "one")
    return NextResponse.json({ error: "not_one_plan" }, { status: 400 });

  await admin.from("parents").update({ subscription_subject: subject }).eq("id", user.id);
  return NextResponse.json({ ok: true });
}
