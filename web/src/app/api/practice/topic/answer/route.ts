import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toPublic } from "@/lib/placementServer";
import { applyAnswer, type ProgressState } from "@/lib/practice";

// Grade one answer inside a topic-practice set. Updates mastery (same Leitner
// state as daily) and the topic session, but never touches streaks/daily feed.
export async function POST(req: Request) {
  const { studentId, sessionId, questionId, selectedIndex, responseTimeMs } = await req.json();
  if (!studentId || !sessionId || !questionId || typeof selectedIndex !== "number")
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
  const { data: session } = await admin
    .from("topic_sessions")
    .select("id, student_id, question_ids, num_completed, num_correct, completed_at")
    .eq("id", sessionId)
    .single();
  if (!session || session.student_id !== student.id)
    return NextResponse.json({ error: "no session" }, { status: 404 });
  if (session.completed_at)
    return NextResponse.json({ error: "already done" }, { status: 409 });

  const ids = session.question_ids as string[];
  const total = ids.length;
  if (ids[session.num_completed] !== questionId)
    return NextResponse.json({ error: "out of order" }, { status: 409 });

  const { data: q } = await admin
    .from("questions")
    .select("id, skill_id, correct_index, explanation, option_explanations")
    .eq("id", questionId)
    .single();
  if (!q) return NextResponse.json({ error: "no question" }, { status: 404 });
  const correct = selectedIndex === q.correct_index;

  // Kid-friendly per-option detail (falls back to the single explanation).
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

  // Spaced-repetition update for this skill (same as daily practice).
  const { data: prog } = await admin
    .from("student_skill_progress")
    .select("box, correct_streak, total_attempts, total_correct")
    .eq("student_id", student.id)
    .eq("skill_id", q.skill_id)
    .maybeSingle();
  const state: ProgressState = prog ?? {
    box: 0,
    correct_streak: 0,
    total_attempts: 0,
    total_correct: 0,
  };
  const upd = applyAnswer(state, correct, now);
  await admin
    .from("student_skill_progress")
    .upsert(
      { student_id: student.id, skill_id: q.skill_id, ...upd },
      { onConflict: "student_id,skill_id" },
    );

  // Advance the topic session.
  const numCompleted = session.num_completed + 1;
  const numCorrect = session.num_correct + (correct ? 1 : 0);
  const done = numCompleted >= total;
  await admin
    .from("topic_sessions")
    .update({
      num_completed: numCompleted,
      num_correct: numCorrect,
      completed_at: done ? now.toISOString() : null,
    })
    .eq("id", session.id);

  let next = null;
  if (!done) {
    const { data: nq } = await admin
      .from("questions")
      .select("id, stem, options, visual")
      .eq("id", ids[numCompleted])
      .single();
    if (nq) next = toPublic({ id: nq.id, stem: nq.stem, options: nq.options, visual: nq.visual });
  }

  return NextResponse.json({
    correct,
    explanation: q.explanation,
    correctIndex,
    whyWrong,
    correctExplanation,
    done,
    total,
    numCompleted,
    numCorrect,
    next,
  });
}
