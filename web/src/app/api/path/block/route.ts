import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudent } from "@/lib/access";
import { getPathForStudent, getOrCreateBlock } from "@/lib/pathServer";
import { getWeekLesson } from "@/lib/lessonsServer";
import { toPublic } from "@/lib/placementServer";

// Start (or resume) the question block for a week. Only the active week is
// playable — you can't skip ahead. Parent or the linked kid may play.
export async function POST(req: Request) {
  const { studentId, skillId } = await req.json();
  if (!studentId || !skillId)
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const supabase = await createClient();
  const admin = createAdminClient();
  const access = await resolveStudent(supabase, admin, studentId);
  if (!access) return NextResponse.json({ error: "not found" }, { status: 404 });
  const student = access.student;

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
    grade: path.effectiveGrade,
    lesson,
    question,
  });
}
