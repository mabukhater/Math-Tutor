import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudent } from "@/lib/access";
import { getPathForStudent, getOrCreateBlock } from "@/lib/pathServer";
import { getWeekLesson } from "@/lib/lessonsServer";
import { gradeLabel } from "@/lib/curriculum";
import { toPublic } from "@/lib/placementServer";
import { checkSubjectGate } from "@/lib/billing";

// Rebuild the client's per-question history for questions already answered in
// this block (so a resumed block shows the right counter/progress/navigator).
async function answeredHistory(admin: SupabaseClient, studentId: string, answeredIds: string[]) {
  if (answeredIds.length === 0) return [];
  const { data: aqs } = await admin
    .from("questions")
    .select("id, stem, options, visual, correct_index, explanation, option_explanations")
    .in("id", answeredIds);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qById = new Map((aqs ?? []).map((q: any) => [q.id as string, q]));
  const { data: atts } = await admin
    .from("attempts")
    .select("question_id, selected_index, is_correct, answered_at")
    .eq("student_id", studentId)
    .in("question_id", answeredIds)
    .order("answered_at", { ascending: true });
  const attByQ = new Map<string, { selected_index: number; is_correct: boolean }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const a of (atts ?? []) as any[]) attByQ.set(a.question_id, a); // ascending => latest wins
  return answeredIds.map((qid) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = qById.get(qid) as any;
    const a = attByQ.get(qid);
    const oe = (q?.option_explanations as string[] | null) ?? null;
    const ci = (q?.correct_index as number) ?? -1;
    const sel = a?.selected_index ?? -1;
    const correct = a?.is_correct ?? false;
    return {
      stem: q?.stem ?? "",
      options: q?.options ?? [],
      visual: q?.visual ?? null,
      selectedIndex: sel,
      correctIndex: ci,
      correct,
      whyWrong: !correct ? oe?.[sel] ?? null : null,
      explanation: q?.explanation ?? "",
      correctExplanation: oe?.[ci] ?? q?.explanation ?? "",
    };
  });
}

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
  // Any week in this student's path is playable — they can revisit a finished
  // week or jump ahead, not just the "suggested next" one. Skills outside the
  // path (wrong curriculum/grade) are still rejected.
  const inPath = path.months.some((m) => m.weeks.some((w) => w.skillId === skillId));
  if (!inPath) return NextResponse.json({ error: "locked" }, { status: 409 });

  // Free-taster gate: a capped subject allows finishing an open lesson + a small
  // number of new lessons per day, then prompts to upgrade.
  const gate = await checkSubjectGate(admin, student, "math", skillId);
  if (gate.locked) return NextResponse.json({ error: "limit", plan: gate.plan }, { status: 402 });

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
  const { data: curr } = skill
    ? await admin
        .from("curricula")
        .select("code, name, grade_noun, grade_offset")
        .eq("id", skill.curriculum_id)
        .maybeSingle()
    : { data: null };
  const { data: topic } = skill?.topic_id
    ? await admin.from("topics").select("name").eq("id", skill.topic_id).maybeSingle()
    : { data: null };
  const tags = {
    grade: curr
      ? gradeLabel(curr.grade_noun, curr.grade_offset, skill?.grade ?? 0, curr.code)
      : `Grade ${skill?.grade ?? ""}`,
    curriculum: curr?.name ?? "",
    topic: topic?.name ?? "",
  };
  // Returned on every question so "Go back to lesson" works mid-block, not just at the start.
  const lesson = skill ? await getWeekLesson(admin, skill) : null;

  const total = block.question_ids.length;
  const idx = block.num_completed;
  let question = null;
  if (idx < total) {
    const { data: q } = await admin
      .from("questions")
      .select("id, stem, options, visual, difficulty")
      .eq("id", block.question_ids[idx])
      .single();
    if (q)
      question = {
        ...toPublic({ id: q.id, stem: q.stem, options: q.options, visual: q.visual }),
        difficulty: (q.difficulty as number) ?? null,
      };
  }

  // Already-answered questions in this block, so a resumed block shows the right
  // counter, progress, and navigator (with each past result) instead of starting
  // the client's history from scratch.
  const answered = await answeredHistory(admin, student.id, block.question_ids.slice(0, idx));

  return NextResponse.json({
    blockId: block.id,
    skillName: skill?.name ?? "",
    tags,
    threshold: block.threshold,
    total,
    numCompleted: block.num_completed,
    numCorrect: block.num_correct,
    grade: path.effectiveGrade,
    lesson,
    question,
    answered,
  });
}
