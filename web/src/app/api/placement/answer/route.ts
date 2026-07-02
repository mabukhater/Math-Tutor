import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initPlacement, recordAnswer, MAX_STEPS } from "@/lib/placement";
import { loadLadder, pickQuestion, toPublic } from "@/lib/placementServer";
import { gradeLabel } from "@/lib/curriculum";
import { clampResponseTime, gradeMcqAnswer } from "@/lib/grading";

interface AskedEntry {
  index: number;
  correct: boolean;
  question_id: string;
}

export async function POST(req: Request) {
  const { sessionId, questionId, selectedIndex, responseTimeMs } = await req.json();
  if (!sessionId || !questionId || typeof selectedIndex !== "number")
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  const rt = clampResponseTime(responseTimeMs);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: session } = await admin
    .from("placement_sessions")
    .select("id, student_id, asked, completed_at, pending_question_id")
    .eq("id", sessionId)
    .single();
  if (!session) return NextResponse.json({ error: "no session" }, { status: 404 });
  if (session.completed_at)
    return NextResponse.json({ error: "already completed" }, { status: 409 });
  // Only grade the exact question the server last served for THIS session.
  // Without this, a caller could POST any questionId from the bank and read back
  // its correct_index — an answer-key oracle. Mirrors the ordering guard in
  // /api/practice/answer.
  if (session.pending_question_id !== questionId)
    return NextResponse.json({ error: "out of order" }, { status: 409 });

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
    .select("id, correct_index, explanation, option_explanations")
    .eq("id", questionId)
    .single();
  if (!q) return NextResponse.json({ error: "no question" }, { status: 404 });
  const { correct, correctIndex, whyWrong, correctExplanation } = gradeMcqAnswer(q, selectedIndex);

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
    let estimatedIndex = newState.done ? newState.estimatedIndex! : clamp(newState.low);
    // Keep placement inside the grade the parent set. The diagnostic can estimate
    // a spot in an adjacent grade; honouring that would put current_skill_index in
    // another grade, so the kid's path (labelled by the skill's grade) would
    // silently disagree with the dashboard's nominal_grade — the exact mismatch a
    // parent sees as "Grade 4 here, Grade 5 there". The parent owns the grade;
    // placement only finds WHERE within it to start.
    const gradeIdx = Object.keys(metaByIndex)
      .map(Number)
      .filter((i) => metaByIndex[i]?.grade === student.nominal_grade);
    if (gradeIdx.length) {
      const gMin = Math.min(...gradeIdx);
      const gMax = Math.max(...gradeIdx);
      estimatedIndex = Math.max(gMin, Math.min(gMax, estimatedIndex));
    }
    await admin
      .from("placement_sessions")
      .update({
        asked: asked2,
        completed_at: new Date().toISOString(),
        estimated_index: estimatedIndex,
        pending_question_id: null,
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
      .select("code, grade_noun, grade_offset")
      .eq("id", student.curriculum_id)
      .single();
    const placedGrade = meta?.grade ?? student.nominal_grade;
    const placedGradeLabel = gradeLabel(cur?.grade_noun, cur?.grade_offset, placedGrade, cur?.code);
    return NextResponse.json({
      done: true,
      correct,
      explanation: q.explanation,
      correctIndex,
      whyWrong,
      correctExplanation,
      estimatedIndex,
      placedGrade,
      placedGradeLabel,
      placedSkillName: meta?.name ?? "",
    });
  }

  // Continue — record progress and serve the next question. Pin the served id so
  // the next answer can only grade this exact question.
  await admin
    .from("placement_sessions")
    .update({ asked: asked2, pending_question_id: nextQ!.id })
    .eq("id", sessionId);
  return NextResponse.json({
    done: false,
    correct,
    explanation: q.explanation,
    correctIndex,
    whyWrong,
    correctExplanation,
    step: asked2.length + 1,
    maxSteps: MAX_STEPS,
    question: toPublic(nextQ!),
  });
}
