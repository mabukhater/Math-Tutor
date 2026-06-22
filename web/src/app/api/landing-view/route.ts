import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Record one impression per landing session (the conversion denominator).
export async function POST(req: Request) {
  const { sessionId, variant } = await req.json();
  if (!sessionId || !["A", "B", "C"].includes(variant))
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const admin = createAdminClient();
  await admin
    .from("landing_views")
    .upsert({ session_id: sessionId, variant }, { onConflict: "session_id", ignoreDuplicates: true });

  return NextResponse.json({ ok: true });
}
