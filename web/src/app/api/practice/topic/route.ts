import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateTopicSession } from "@/lib/topicsServer";
import { getLesson } from "@/lib/lessonsServer";
import { toPublic } from "@/lib/placementServer";
import { resolveStudent } from "@/lib/access";

// Start (or resume) a focused topic-practice set. Isolated from the daily feed.
export async function POST(req: Request) {
  const { studentId, topicCode } = await req.json();
  if (!studentId || !topicCode)
    return NextResponse.json({ error: "bad request" }, { status: 400 });

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

  const { data: topic } = await admin
    .from("topics")
    .select("id, name")
    .eq("code", topicCode)
    .single();
  if (!topic) return NextResponse.json({ error: "no_topic" }, { status: 404 });

  let session;
  try {
    session = await getOrCreateTopicSession(admin, student, topic.id as string);
  } catch {
    return NextResponse.json({ error: "no_questions" }, { status: 409 });
  }

  const total = session.question_ids.length;
  const idx = session.num_completed;
  const done = idx >= total;

  // Lesson to read before practicing (only surfaced when the set is fresh).
  const lesson =
    idx === 0
      ? await getLesson(admin, student.curriculum_id, topic.id as string, student.nominal_grade)
      : null;

  let question = null;
  if (!done) {
    const { data: q } = await admin
      .from("questions")
      .select("id, stem, options, visual")
      .eq("id", session.question_ids[idx])
      .single();
    if (q) question = toPublic({ id: q.id, stem: q.stem, options: q.options, visual: q.visual });
  }

  return NextResponse.json({
    sessionId: session.id,
    topicName: topic.name,
    studentName: student.display_name ?? "",
    total,
    numCompleted: session.num_completed,
    numCorrect: session.num_correct,
    completed: done,
    lesson,
    question,
  });
}
