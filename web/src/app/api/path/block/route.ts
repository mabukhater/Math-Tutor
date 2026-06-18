import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPathForStudent, getOrCreateBlock } from "@/lib/pathServer";
import { getWeekLesson } from "@/lib/lessonsServer";
import { toPublic } from "@/lib/placementServer";

// Start (or resume) the question block for a week. Only the active week is
// playable — you can't skip ahead.
export async function POST(req: Request) {
  const { studentId, skillId } = await req.json();
  if (!studentId || !skillId)
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students")
    .select("id, curriculum_id, nominal_grade, current_skill_index, pass_threshold, display_name")
    .eq("id", studentId)
    .single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const admin = createAdminClient();
  const path = await getPathForStudent(admin, student);
  if (path.activeSkillId !== skillId)
    return NextResponse.json({ error: "locked" }, { status: 409 });

  let block;
  try {
    block = await getOrCreateBlock(admin, student, skillId);
  } catch {
    return NextResponse.json({ error: "no_questions" }, { status: 409 });
  }

  const { data: skill } = await admin
    .from("skills")
    .select("id, name, curriculum_id, topic_id, grade")
    .eq("id", skillId)
    .single();
  const lesson =
    block.num_completed === 0 && skill ? await getWeekLesson(admin, skill) : null;

  const total = block.question_ids.length;
  const idx = block.num_completed;
  let question = null;
  if (idx < total) {
    const { data: q } = await admin
      .from("questions")
      .select("id, stem, options, visual")
      .eq("id", block.question_ids[idx])
      .single();
    if (q) question = toPublic({ id: q.id, stem: q.stem, options: q.options, visual: q.visual });
  }

  return NextResponse.json({
    blockId: block.id,
    skillName: skill?.name ?? "",
    threshold: block.threshold,
    total,
    numCompleted: block.num_completed,
    numCorrect: block.num_correct,
    lesson,
    question,
  });
}
