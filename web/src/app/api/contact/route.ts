import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendContactEmail } from "@/lib/email";

export const runtime = "nodejs";

// A parent submits feedback (bug/feature/idea). Persist it, then email a
// notification (best-effort — the row is already saved if email isn't set up).
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const { category, subject, message } = await req.json();
  const subj = String(subject ?? "").trim().slice(0, 200);
  const msg = String(message ?? "").trim().slice(0, 5000);
  const cat = String(category ?? "").trim().slice(0, 40);
  if (!subj || !msg) return NextResponse.json({ error: "missing" }, { status: 400 });

  const admin = createAdminClient();
  const { data: parent } = await admin
    .from("parents")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  const email = parent?.email ?? user.email ?? "";

  const { error } = await admin
    .from("contact_messages")
    .insert({ parent_id: user.id, email, category: cat, subject: subj, message: msg });
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });

  const { sent } = await sendContactEmail({
    fromName: parent?.full_name ?? "",
    fromEmail: email,
    category: cat,
    subject: subj,
    message: msg,
  });

  return NextResponse.json({ ok: true, emailed: sent });
}
