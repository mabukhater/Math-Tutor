import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPathForStudent } from "@/lib/pathServer";
import { gradeLabel } from "@/lib/curriculum";

export async function POST(req: Request) {
  const { studentId } = await req.json();
  if (!studentId) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students")
    .select("id, curriculum_id, nominal_grade, current_skill_index, pass_threshold, display_name, placement_completed")
    .eq("id", studentId)
    .single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!student.placement_completed)
    return NextResponse.json({ error: "placement_required" }, { status: 409 });

  const admin = createAdminClient();
  const path = await getPathForStudent(admin, student);
  const { data: cur } = await admin
    .from("curricula")
    .select("code, name, grade_noun, grade_offset")
    .eq("id", student.curriculum_id)
    .single();

  return NextResponse.json({
    studentName: student.display_name ?? "",
    curriculumName: cur?.name ?? "",
    gradeLabel: gradeLabel(cur?.grade_noun, cur?.grade_offset, student.nominal_grade, cur?.code),
    ...path,
  });
}
