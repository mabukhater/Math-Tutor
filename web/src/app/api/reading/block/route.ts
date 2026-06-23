import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudent } from "@/lib/access";
import { getReadingPath, getOrCreateReadingBlock } from "@/lib/readingServer";

// Already-answered questions in this block. Reading attempts don't record the
// per-question result, so on a resumed block these show as neutral "answered"
// (result unknown) — enough to keep the counter/progress/navigator consistent
// and let the child re-open a question to see its correct answer.
async function answeredReadingHistory(admin: SupabaseClient, answeredIds: string[]) {
  if (answeredIds.length === 0) return [];
  const { data: aqs } = await admin
    .from("reading_questions")
    .select("id, stem, options, correct_index, explanation")
    .in("id", answeredIds);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qById = new Map((aqs ?? []).map((q: any) => [q.id as string, q]));
  return answeredIds.map((qid) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = qById.get(qid) as any;
    return {
      stem: q?.stem ?? "",
      options: q?.options ?? [],
      selectedIndex: -1,
      correctIndex: (q?.correct_index as number) ?? -1,
      correct: null,
      locator: null,
      explanation: q?.explanation ?? "",
    };
  });
}

// Start (or resume) the comprehension block for a passage. Returns the passage
// text so the child can read it; only the active passage is playable. Parent or
// the linked kid may play.
export async function POST(req: Request) {
  const { studentId, passageId } = await req.json();
  if (!studentId || !passageId)
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const supabase = await createClient();
  const admin = createAdminClient();
  const access = await resolveStudent(supabase, admin, studentId);
  if (!access) return NextResponse.json({ error: "not found" }, { status: 404 });
  const student = access.student;

  const path = await getReadingPath(admin, student);
  // Any passage in this student's path is playable (revisit or jump ahead).
  const inPath = path.weeks.some((wk) => wk.passages.some((p) => p.passageId === passageId));
  if (!inPath) return NextResponse.json({ error: "locked" }, { status: 409 });

  let block;
  try {
    block = await getOrCreateReadingBlock(admin, student, passageId);
  } catch {
    return NextResponse.json({ error: "no_questions" }, { status: 409 });
  }

  const { data: passage } = await admin
    .from("passages")
    .select("title, paragraphs")
    .eq("id", passageId)
    .single();

  const total = block.question_ids.length;
  const idx = block.num_completed;
  let question = null;
  if (idx < total) {
    const { data: q } = await admin
      .from("reading_questions")
      .select("id, stem, options")
      .eq("id", block.question_ids[idx])
      .single();
    if (q) question = { id: q.id, stem: q.stem, options: q.options };
  }

  const answered = await answeredReadingHistory(admin, block.question_ids.slice(0, idx));

  return NextResponse.json({
    blockId: block.id,
    title: passage?.title ?? "",
    paragraphs: passage?.paragraphs ?? [],
    threshold: block.threshold,
    total,
    numCompleted: block.num_completed,
    numCorrect: block.num_correct,
    grade: student.nominal_grade,
    question,
    answered,
  });
}
