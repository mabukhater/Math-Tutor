import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initPlacement, MAX_STEPS } from "@/lib/placement";
import { loadLadder, pickQuestion, toPublic } from "@/lib/placementServer";

export async function POST(req: Request) {
  const { studentId } = await req.json();
  if (!studentId) return NextResponse.json({ error: "missing studentId" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // RLS confirms this student belongs to the signed-in parent.
  const { data: student } = await supabase
    .from("students")
    .select("id, display_name, nominal_grade, curriculum_id")
    .eq("id", studentId)
    .single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const admin = createAdminClient();
  const { ladder, idByIndex } = await loadLadder(admin, student.curriculum_id);
  if (ladder.length === 0) return NextResponse.json({ error: "no ladder" }, { status: 500 });

  const state = initPlacement(ladder, student.nominal_grade);
  const q = await pickQuestion(admin, idByIndex[state.estimate], []);
  if (!q)
    return NextResponse.json(
      { error: "no_vetted_question", skillIndex: state.estimate },
      { status: 422 },
    );

  const { data: session, error } = await admin
    .from("placement_sessions")
    .insert({ student_id: studentId, asked: [], pending_question_id: q.id })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    sessionId: session.id,
    studentName: student.display_name,
    step: 1,
    maxSteps: MAX_STEPS,
    question: toPublic(q),
  });
}
