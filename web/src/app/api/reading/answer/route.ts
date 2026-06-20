import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { markPassagePassed } from "@/lib/readingServer";

// Grade one comprehension answer. On a wrong answer, return the LOCATOR (the
// paragraph + hint) so the child is sent back into the text. When the block
// finishes, pass/fail against the threshold and unlock the next passage.
export async function POST(req: Request) {
  const { studentId, blockId, questionId, selectedIndex, responseTimeMs } = await req.json();
  if (!studentId || !blockId || !questionId || typeof selectedIndex !== "number")
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  const rt =
    typeof responseTimeMs === "number" && isFinite(responseTimeMs) && responseTimeMs >= 0
      ? Math.min(Math.round(responseTimeMs), 3_600_000)
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", studentId)
    .single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const admin = createAdminClient();
  const { data: block } = await admin
    .from("reading_blocks")
    .select("id, student_id, passage_id, question_ids, num_completed, num_correct, passed, threshold")
    .eq("id", blockId)
    .single();
  if (!block || block.student_id !== student.id)
    return NextResponse.json({ error: "no block" }, { status: 404 });
  if (block.passed !== null) return NextResponse.json({ error: "block done" }, { status: 409 });

  const ids = block.question_ids as string[];
  const total = ids.length;
  if (ids[block.num_completed] !== questionId)
    return NextResponse.json({ error: "out of order" }, { status: 409 });

  const { data: q } = await admin
    .from("reading_questions")
    .select("id, correct_index, explanation, locator")
    .eq("id", questionId)
    .single();
  if (!q) return NextResponse.json({ error: "no question" }, { status: 404 });
  const correct = selectedIndex === q.correct_index;
  const correctIndex = q.correct_index as number;
  const locator = !correct ? (q.locator as { paragraph: number; hint: string } | null) ?? null : null;

  const now = new Date();
  await admin.from("attempts").insert({
    student_id: student.id,
    question_id: null, // math attempts table; reading question ids live elsewhere
    selected_index: selectedIndex,
    is_correct: correct,
    response_time_ms: rt,
  });

  // Per-passage stats (for the path accuracy display).
  const { data: prog } = await admin
    .from("reading_progress")
    .select("total_attempts, total_correct")
    .eq("student_id", student.id)
    .eq("passage_id", block.passage_id)
    .maybeSingle();
  await admin.from("reading_progress").upsert(
    {
      student_id: student.id,
      passage_id: block.passage_id,
      total_attempts: (prog?.total_attempts ?? 0) + 1,
      total_correct: (prog?.total_correct ?? 0) + (correct ? 1 : 0),
    },
    { onConflict: "student_id,passage_id" },
  );

  const numCompleted = block.num_completed + 1;
  const numCorrect = block.num_correct + (correct ? 1 : 0);
  const blockDone = numCompleted >= total;
  const accuracy = Math.round((100 * numCorrect) / total);
  const passed = blockDone ? accuracy >= block.threshold : null;

  await admin
    .from("reading_blocks")
    .update({
      num_completed: numCompleted,
      num_correct: numCorrect,
      passed,
      completed_at: blockDone ? now.toISOString() : null,
    })
    .eq("id", block.id);

  if (blockDone && passed) {
    await markPassagePassed(admin, student.id, block.passage_id);
  }

  let next = null;
  if (!blockDone) {
    const { data: nq } = await admin
      .from("reading_questions")
      .select("id, stem, options")
      .eq("id", ids[numCompleted])
      .single();
    if (nq) next = { id: nq.id, stem: nq.stem, options: nq.options };
  }

  return NextResponse.json({
    correct,
    correctIndex,
    explanation: q.explanation,
    locator,
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
