import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreateDailySet, streakForStudent } from "@/lib/practiceServer";
import { toPublic } from "@/lib/placementServer";
import { resolveStudent } from "@/lib/access";

export async function POST(req: Request) {
  const { studentId } = await req.json();
  if (!studentId) return NextResponse.json({ error: "missing studentId" }, { status: 400 });

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
  if (!student.placement_completed)
    return NextResponse.json({ error: "placement_required" }, { status: 409 });

  const now = new Date();
  const session = await getOrCreateDailySet(admin, student, now);
  const total = session.question_ids.length;
  const completed = session.num_completed >= total;

  let question = null;
  if (!completed) {
    const nextId = session.question_ids[session.num_completed];
    const { data: q } = await admin
      .from("questions")
      .select("id, stem, options, visual")
      .eq("id", nextId)
      .single();
    if (q) question = toPublic({ id: q.id, stem: q.stem, options: q.options, visual: q.visual });
  }

  const streak = await streakForStudent(admin, student.id, now);

  return NextResponse.json({
    studentName: student.display_name,
    total,
    numCompleted: session.num_completed,
    numCorrect: session.num_correct,
    completed,
    streak,
    question,
  });
}
