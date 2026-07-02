import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudent } from "@/lib/access";
import {
  getReadingPath,
  getAICoursePath,
  getOrCreateReadingBlock,
  toPublicReadingQuestion,
} from "@/lib/readingServer";
import { checkSubjectGate, checkAiGate } from "@/lib/billing";

// Already-answered questions in this block, with their real result so a resumed
// block shows each prior question's green/red (not a neutral grey). Pulls the
// child's recorded attempt (is_correct + selected option) per reading question.
async function answeredReadingHistory(
  admin: SupabaseClient,
  studentId: string,
  answeredIds: string[],
) {
  if (answeredIds.length === 0) return [];
  const { data: aqs } = await admin
    .from("reading_questions")
    .select("id, stem, options, correct_index, explanation")
    .in("id", answeredIds);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qById = new Map((aqs ?? []).map((q: any) => [q.id as string, q]));

  // The child's actual results, keyed by reading question (latest attempt wins).
  const { data: ats } = await admin
    .from("attempts")
    .select("reading_question_id, selected_index, is_correct, answered_at")
    .eq("student_id", studentId)
    .in("reading_question_id", answeredIds)
    .order("answered_at", { ascending: true });
  const resultByQid = new Map<string, { selectedIndex: number; correct: boolean }>();
  for (const a of ats ?? []) {
    resultByQid.set(a.reading_question_id as string, {
      selectedIndex: (a.selected_index as number) ?? -1,
      correct: !!a.is_correct,
    });
  }

  return answeredIds.map((qid) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = qById.get(qid) as any;
    const r = resultByQid.get(qid);
    return {
      stem: q?.stem ?? "",
      options: q?.options ?? [],
      selectedIndex: r?.selectedIndex ?? -1,
      correctIndex: (q?.correct_index as number) ?? -1,
      correct: r ? r.correct : null,
      locator: null,
      explanation: q?.explanation ?? "",
    };
  });
}

// Start (or resume) the comprehension block for a passage. Returns the passage
// text so the child can read it; only the active passage is playable. Parent or
// the linked kid may play.
//
// The optional `subject` param ("ai7" | "ai8") routes AI passages through
// getAICoursePath for the membership check, keeping correct_index server-side
// for AI questions (AC-2.4 / AC-8.5). Defaults to "reading".
export async function POST(req: Request) {
  const body = await req.json();
  const { studentId, passageId } = body as {
    studentId: string;
    passageId: string;
    subject?: "ai7" | "ai8";
  };
  const subject: "reading" | "ai7" | "ai8" = body.subject ?? "reading";

  if (!studentId || !passageId)
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const supabase = await createClient();
  const admin = createAdminClient();
  const access = await resolveStudent(supabase, admin, studentId);
  if (!access) return NextResponse.json({ error: "not found" }, { status: 404 });
  const student = access.student;

  // Membership check: the passage must be in the student's active path.
  let inPath = false;
  if (subject === "ai7" || subject === "ai8") {
    // AI 7/8 is a grade 7–8 course only — reject AI block requests for others.
    if (student.nominal_grade !== 7 && student.nominal_grade !== 8)
      return NextResponse.json({ error: "grade_locked" }, { status: 403 });
    const path = await getAICoursePath(admin, student, subject);
    inPath = path.weeks.some((wk) => wk.passages.some((p) => p.passageId === passageId));

    // AI billing gate (always unlocked — OQ-6; TODO: wire once pricing decided).
    const gate = checkAiGate();
    if (gate.locked) return NextResponse.json({ error: "limit", plan: gate.plan }, { status: 402 });
  } else {
    const path = await getReadingPath(admin, student);
    inPath = path.weeks.some((wk) => wk.passages.some((p) => p.passageId === passageId));

    const gate = await checkSubjectGate(admin, student, "reading", passageId);
    if (gate.locked) return NextResponse.json({ error: "limit", plan: gate.plan }, { status: 402 });
  }

  if (!inPath) return NextResponse.json({ error: "locked" }, { status: 409 });

  let block;
  try {
    block = await getOrCreateReadingBlock(admin, student, passageId);
  } catch {
    return NextResponse.json({ error: "no_questions" }, { status: 409 });
  }

  const { data: passage } = await admin
    .from("passages")
    .select("title, paragraphs, grade, subject")
    .eq("id", passageId)
    .single();

  const total = block.question_ids.length;
  const idx = block.num_completed;
  let question = null;
  if (idx < total) {
    const { data: q } = await admin
      .from("reading_questions")
      .select("id, stem, options, difficulty, locator")
      .eq("id", block.question_ids[idx])
      .single();
    if (q) question = toPublicReadingQuestion(q);
  }

  const answered = await answeredReadingHistory(admin, student.id, block.question_ids.slice(0, idx));

  // Tag label: show subject for AI passages, "Reading" for everything else.
  const subjectLabel =
    subject === "ai7"
      ? "AI 7: Foundations"
      : subject === "ai8"
        ? "AI 8: Builds On"
        : "Reading";

  return NextResponse.json({
    blockId: block.id,
    title: passage?.title ?? "",
    paragraphs: passage?.paragraphs ?? [],
    tags: {
      grade: passage?.grade != null ? `Grade ${passage.grade}` : "",
      curriculum: subjectLabel,
      topic: "",
    },
    subject,
    threshold: block.threshold,
    total,
    numCompleted: block.num_completed,
    numCorrect: block.num_correct,
    grade: student.nominal_grade,
    question,
    answered,
  });
}
