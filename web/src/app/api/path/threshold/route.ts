import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Parent sets the pass mark for a child (percent, 50-100).
export async function POST(req: Request) {
  const { studentId, threshold } = await req.json();
  const t = Math.round(Number(threshold));
  if (!studentId || !Number.isFinite(t) || t < 50 || t > 100)
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS ensures the parent can only update their own child.
  const { error } = await supabase
    .from("students")
    .update({ pass_threshold: t })
    .eq("id", studentId);
  if (error) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ ok: true, threshold: t });
}
