import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Move a child to a different grade level. Sets nominal_grade (the label) AND
// repositions the path cursor to the first skill of that grade, so the content
// they get actually matches the new level. Existing student_skill_progress rows
// are left untouched — harmless to the new path, and preserved if they switch
// back. Ownership is enforced by RLS on the initial select.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const { studentId, grade } = await req.json();
  const g = Number(grade);
  if (!studentId || !Number.isInteger(g) || g < 0 || g > 13) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data: student } = await supabase
    .from("students")
    .select("id, curriculum_id")
    .eq("id", studentId)
    .single();
  if (!student) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const admin = createAdminClient();
  // Where the path resumes: the first skill (lowest sequence_position) at the
  // target grade in this curriculum. If none exists, the grade has no content.
  const { data: first } = await admin
    .from("skills")
    .select("sequence_position")
    .eq("curriculum_id", student.curriculum_id)
    .eq("grade", g)
    .order("sequence_position", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!first) return NextResponse.json({ error: "no_content_for_grade" }, { status: 400 });

  const { error } = await admin
    .from("students")
    .update({
      nominal_grade: g,
      current_skill_index: first.sequence_position,
      placement_completed: true, // the parent has explicitly placed them
    })
    .eq("id", studentId);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
