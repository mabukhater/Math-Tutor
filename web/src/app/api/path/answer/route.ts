import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudent } from "@/lib/access";
import { toPublic } from "@/lib/placementServer";
import { markSkillPassed, type PathStudent } from "@/lib/pathServer";

// Grade one answer in a path block. When the block finishes, decide pass/fail
// against the snapshotted threshold; passing marks the week complete and
// unlocks the next.
export async function POST(req: Request) {
  const { studentId, blockId, questionId, selectedIndex, responseTimeMs } = await req.json();
  if (!studentId || !blockId || !questionId || typeof selectedIndex !== "number")
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  const rt =
    typeof responseTimeMs === "number" && isFinite(responseTimeMs) && responseTimeMs >= 0
      ? Math.min(Math.round(responseTimeMs), 3_600_000)
      : null;

  const supabase = await createClient();
  const admin = createAdminClient();
  const access = await resolveStudent(supabase, admin, studentId);
  if (!access) return NextResponse.json({ error: "not found" }, { status: 404 });
  const student = access.student;

  const { data: block } = await admin
    .from("path_blocks")
    .select("id, student_id, skill_id, question_ids, num_completed, num_correct, passed, threshold")
    .eq("id", blockId)
    .single();
  if (!block || block.student_id !== student.id)
    return NextResponse.json({ error: "no block" }, { status: 404 });
  if (block.passed !== null)
    return NextResponse.json({ error: "block done" }, { status: 409 });

  const ids = block.question_ids as string[];
  const total = ids.length;
  if (ids[block.num_completed] !== questionId)
    return NextResponse.json({ error: "out of order" }, { status: 409 });

  const { data: q } = await admin
    .from("questions")
    .select("id, skill_id, correct_index, explanation, option_explanations")
    .eq("id", questionId)
    .single();
  if (!q) return NextResponse.json({ error: "no question" }, { status: 404 });
  const correct = selectedIndex === q.correct_index;

  const oe = (q.option_explanations as string[] | null) ?? null;
  const correctIndex = q.correct_index as number;
  const whyWrong = !correct ? (oe?.[selectedIndex] ?? null) : null;
  const correctExplanation = oe?.[correctIndex] ?? q.explanation;

  const now = new Date();
  await admin.from("attempts").insert({
    student_id: student.id,
    question_id: questionId,
    selected_index: selectedIndex,
    is_correct: correct,
    response_time_ms: rt,
  });

  // Keep lifetime per-skill stats (used for the path accuracy display).
  const { data: prog } = await admin
    .from("student_skill_progress")
    .select("total_attempts, total_correct")
    .eq("student_id", student.id)
    .eq("skill_id", block.skill_id)
    .maybeSingle();
  await admin.from("student_skill_progress").upsert(
    {
      student_id: student.id,
      skill_id: block.skill_id,
      total_attempts: (prog?.total_attempts ?? 0) + 1,
      total_correct: (prog?.total_correct ?? 0) + (correct ? 1 : 0),
      last_seen_at: now.toISOString(),
    },
    { onConflict: "student_id,skill_id" },
  );

  const numCompleted = block.num_completed + 1;
  const numCorrect = block.num_correct + (correct ? 1 : 0);
  const blockDone = numCompleted >= total;
  const accuracy = Math.round((100 * numCorrect) / total);
  const passed = blockDone ? accuracy >= block.threshold : null;

  await admin
    .from("path_blocks")
    .update({
      num_completed: numCompleted,
      num_correct: numCorrect,
      passed,
      completed_at: blockDone ? now.toISOString() : null,
    })
    .eq("id", block.id);

  if (blockDone && passed) {
    await markSkillPassed(admin, student as PathStudent, block.skill_id);
  }

  let next = null;
  if (!blockDone) {
    const { data: nq } = await admin
      .from("questions")
      .select("id, stem, options, visual, difficulty")
      .eq("id", ids[numCompleted])
      .single();
    // Carry `difficulty` through so the chip stays put across questions — the
    // block (start/resume) route includes it, so the "next" payload must too.
    if (nq)
      next = {
        ...toPublic({ id: nq.id, stem: nq.stem, options: nq.options, visual: nq.visual }),
        difficulty: (nq.difficulty as number) ?? null,
      };
  }

  return NextResponse.json({
    correct,
    explanation: q.explanation,
    correctIndex,
    whyWrong,
    correctExplanation,
    blockDone,
    passed,
    accuracy,
    threshold: block.threshold,
    total,
    numCompleted,
    numCorrect,
    next,
  });
}
