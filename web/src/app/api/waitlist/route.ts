import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const { email, variant, situation, sessionId } = await req.json();
  const e = String(email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(e) || (variant !== "A" && variant !== "B"))
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("waitlist").upsert(
    {
      email: e,
      variant,
      situation: typeof situation === "string" && situation ? situation : null,
      session_id: typeof sessionId === "string" ? sessionId : null,
    },
    { onConflict: "email", ignoreDuplicates: false },
  );
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });

  if (sessionId) {
    await admin.from("landing_views").update({ signed_up: true }).eq("session_id", sessionId);
  }

  return NextResponse.json({ ok: true });
}
