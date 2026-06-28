import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudent } from "@/lib/access";
import { getAICoursePath } from "@/lib/readingServer";

// POST /api/ai/path
// Returns the AI course ladder (weeks + passages with status) for a student.
// course = 'ai7' | 'ai8'. For ai8 when AI-7 incomplete, returns unlocked:false
// with an empty weeks array and a prereqMessage (AC-3.1).
//
// Auth: parent or linked kid (resolveStudent → 404 if not owned, AC-7.3).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { studentId, course } = (body ?? {}) as { studentId?: string; course?: string };

  if (!studentId || (course !== "ai7" && course !== "ai8"))
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const supabase = await createClient();
  const admin = createAdminClient();
  const access = await resolveStudent(supabase, admin, studentId);
  if (!access) return NextResponse.json({ error: "not found" }, { status: 404 });

  const path = await getAICoursePath(admin, access.student, course);

  return NextResponse.json({
    studentName: access.student.display_name ?? "",
    ...path,
    // Derive course-complete client-side: passedPassages === totalPassages
    // (and totalPassages > 0) means all content is cleared (AC-2.5).
  });
}
