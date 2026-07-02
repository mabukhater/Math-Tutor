import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateDailySet, streakForStudent } from "@/lib/practiceServer";
import { toPublic } from "@/lib/placementServer";
import { applyAnswer, type ProgressState } from "@/lib/practice";
import { resolveStudent } from "@/lib/access";
import { clampResponseTime, gradeMcqAnswer } from "@/lib/grading";

export async function POST(req: Request) {
  const { studentId, questionId, selectedIndex, responseTimeMs } = await req.json();
  if (!studentId || !questionId || typeof selectedIndex !== "number")
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  const rt = clampResponseTime(responseTimeMs);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Parent who owns the student, OR the kid whose login is linked to them.
  const admin = createAdminClient();
  const access = await resolveStudent(supabase, admin, studentId);
  if (!access) return NextResponse.json({ error: "not found" }, { status: 404 });
  const student = access.student;

  const now = new Date();
  const session = await getOrCreateDailySet(admin, student, now);
  const total = session.question_ids.length;

  if (session.num_completed >= total)
    return NextResponse.json({ error: "already done" }, { status: 409 });
  if (session.question_ids[session.num_completed] !== questionId)
    return NextResponse.json({ error: "out of order" }, { status: 409 });

  // Grade server-side.
  const { data: q } = await admin
    .from("questions")
    .select("id, skill_id, correct_index, explanation, option_explanations")
    .eq("id", questionId)
    .single();
  if (!q) return NextResponse.json({ error: "no question" }, { status: 404 });
  const { correct, correctIndex, whyWrong, correctExplanation } = gradeMcqAnswer(q, selectedIndex);

  // Telemetry.
  await admin.from("attempts").insert({
    student_id: student.id,
    question_id: questionId,
    selected_index: selectedIndex,
    is_correct: correct,
    response_time_ms: rt,
  });

  // Spaced-repetition update for this skill.
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

  // Advance the daily session.
  const numCompleted = session.num_completed + 1;
  const numCorrect = session.num_correct + (correct ? 1 : 0);
  const done = numCompleted >= total;
  await admin
    .from("daily_sessions")
    .update({
      num_completed: numCompleted,
      num_correct: numCorrect,
      completed_at: done ? now.toISOString() : null,
    })
    .eq("id", session.id);

  const streak = await streakForStudent(admin, student.id, now);

  let next = null;
  if (!done) {
    const { data: nq } = await admin
      .from("questions")
      .select("id, stem, options, visual")
      .eq("id", session.question_ids[numCompleted])
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
    streak,
    next,
  });
}
