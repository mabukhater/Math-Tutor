import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initPlacement, recordAnswer, MAX_STEPS } from "@/lib/placement";
import { loadLadder, pickQuestion, toPublic } from "@/lib/placementServer";

interface AskedEntry {
  index: number;
  correct: boolean;
  question_id: string;
}

export async function POST(req: Request) {
  const { sessionId, questionId, selectedIndex, responseTimeMs } = await req.json();
  if (!sessionId || !questionId || typeof selectedIndex !== "number")
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

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("placement_sessions")
    .select("id, student_id, asked, completed_at")
    .eq("id", sessionId)
    .single();
  if (!session) return NextResponse.json({ error: "no session" }, { status: 404 });
  if (session.completed_at)
    return NextResponse.json({ error: "already completed" }, { status: 409 });

  // Ownership check through RLS.
  const { data: student } = await supabase
    .from("students")
    .select("id, nominal_grade, curriculum_id")
    .eq("id", session.student_id)
    .single();
  if (!student) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { ladder, idByIndex, metaByIndex } = await loadLadder(admin, student.curriculum_id);

  // Rebuild engine state by replaying the recorded answers.
  const asked: AskedEntry[] = (session.asked as AskedEntry[]) ?? [];
  let state = initPlacement(ladder, student.nominal_grade);
  for (const a of asked) state = recordAnswer(state, a.correct);

  // Grade the just-answered question (server-side; correct_index never left here).
  const { data: q } = await admin
    .from("questions")
    .select("id, correct_index, explanation")
    .eq("id", questionId)
    .single();
  if (!q) return NextResponse.json({ error: "no question" }, { status: 404 });
  const correct = selectedIndex === q.correct_index;

  const askedIndex = state.estimate;
  const newState = recordAnswer(state, correct);
  const asked2: AskedEntry[] = [
    ...asked,
    { index: askedIndex, correct, question_id: questionId },
  ];

  // Telemetry.
  await admin.from("attempts").insert({
    student_id: student.id,
    question_id: questionId,
    selected_index: selectedIndex,
    is_correct: correct,
    response_time_ms: rt,
  });

  // If the search continues, try to fetch the next question first. If the next
  // rung has no vetted question yet (partial vetting), finalize gracefully at
  // the best-known level rather than erroring mid-placement.
  const clamp = (x: number) => Math.max(0, Math.min(x, newState.n));
  let nextQ = null;
  if (!newState.done) {
    nextQ = await pickQuestion(
      admin,
      idByIndex[newState.estimate],
      asked2.map((a) => a.question_id),
    );
  }

  const mustFinish = newState.done || nextQ === null;
  if (mustFinish) {
    const estimatedIndex = newState.done ? newState.estimatedIndex! : clamp(newState.low);
    await admin
      .from("placement_sessions")
      .update({
        asked: asked2,
        completed_at: new Date().toISOString(),
        estimated_index: estimatedIndex,
      })
      .eq("id", sessionId);
    await admin
      .from("students")
      .update({ current_skill_index: estimatedIndex, placement_completed: true })
      .eq("id", student.id);

    // Seed spaced-repetition state around the placement (box 0, due now).
    const now = new Date().toISOString();
    const seedRows = [];
    for (let i = estimatedIndex - 1; i <= estimatedIndex + 2; i++) {
      if (idByIndex[i]) {
        seedRows.push({ student_id: student.id, skill_id: idByIndex[i], box: 0, next_due_at: now });
      }
    }
    if (seedRows.length)
      await admin
        .from("student_skill_progress")
        .upsert(seedRows, { onConflict: "student_id,skill_id", ignoreDuplicates: true });

    const meta = metaByIndex[estimatedIndex];
    const { data: cur } = await admin
      .from("curricula")
      .select("grade_noun, grade_offset")
      .eq("id", student.curriculum_id)
      .single();
    const placedGrade = meta?.grade ?? student.nominal_grade;
    const placedGradeLabel = `${cur?.grade_noun ?? "Grade"} ${placedGrade + (cur?.grade_offset ?? 0)}`;
    return NextResponse.json({
      done: true,
      correct,
      explanation: q.explanation,
      estimatedIndex,
      placedGrade,
      placedGradeLabel,
      placedSkillName: meta?.name ?? "",
    });
  }

  // Continue — record progress and serve the next question.
  await admin.from("placement_sessions").update({ asked: asked2 }).eq("id", sessionId);
  return NextResponse.json({
    done: false,
    correct,
    explanation: q.explanation,
    step: asked2.length + 1,
    maxSteps: MAX_STEPS,
    question: toPublic(nextQ!),
  });
}
