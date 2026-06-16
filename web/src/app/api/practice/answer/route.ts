import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateDailySet, streakForStudent } from "@/lib/practiceServer";
import { toPublic } from "@/lib/placementServer";
import { applyAnswer, type ProgressState } from "@/lib/practice";

export async function POST(req: Request) {
  const { studentId, questionId, selectedIndex, responseTimeMs } = await req.json();
  if (!studentId || !questionId || typeof selectedIndex !== "number")
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
    .select("id, curriculum_id, current_skill_index, questions_per_day, placement_completed")
    .eq("id", studentId)
    .single();
  if (!student) return NextResponse.json({ error: "not found" }, { status: 404 });

  const admin = createAdminClient();
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
    .select("id, skill_id, correct_index, explanation")
    .eq("id", questionId)
    .single();
  if (!q) return NextResponse.json({ error: "no question" }, { status: 404 });
  const correct = selectedIndex === q.correct_index;

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
      .select("id, stem, options")
      .eq("id", session.question_ids[numCompleted])
      .single();
    if (nq) next = toPublic({ id: nq.id, stem: nq.stem, options: nq.options });
  }

  return NextResponse.json({
    correct,
    explanation: q.explanation,
    done,
    total,
    numCompleted,
    numCorrect,
    streak,
    next,
  });
}
