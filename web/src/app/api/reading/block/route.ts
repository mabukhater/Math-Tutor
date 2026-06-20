import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudent } from "@/lib/access";
import { getReadingPath, getOrCreateReadingBlock } from "@/lib/readingServer";

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
  if (path.activePassageId !== passageId)
    return NextResponse.json({ error: "locked" }, { status: 409 });

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

  return NextResponse.json({
    blockId: block.id,
    title: passage?.title ?? "",
    paragraphs: passage?.paragraphs ?? [],
    threshold: block.threshold,
    total,
    numCompleted: block.num_completed,
    numCorrect: block.num_correct,
    question,
  });
}
