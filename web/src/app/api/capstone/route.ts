import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudent } from "@/lib/access";
import { getOrCreateCapstone } from "@/lib/capstoneServer";
import { isAi8Unlocked, getAICoursePath } from "@/lib/readingServer";
import type { CapstoneLevel } from "@/lib/capstoneTypes";

// POST /api/capstone
// Lazy-creates the capstone + milestone rows on first access, then returns the
// current state with computed milestone statuses and signed URLs for file artifacts.
//
// Level 7 capstone requires AI-7 completion; level 8 requires AI-8 completion.
//
// Auth: parent or linked kid (resolveStudent → 404 if not owned, AC-7.3).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { studentId, level } = (body ?? {}) as { studentId?: string; level?: number };

  if (!studentId || (level !== 7 && level !== 8))
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const supabase = await createClient();
  const admin = createAdminClient();
  const access = await resolveStudent(supabase, admin, studentId);
  if (!access) return NextResponse.json({ error: "not found" }, { status: 404 });
  const student = access.student;

  // Gate: capstone availability requires completing the corresponding AI course.
  const capstoneLevel: CapstoneLevel = level === 7 ? "l7" : "l8";
  if (level === 7) {
    // L7 capstone gates on AI-7 completion (same check as AI-8 unlock).
    const ai7Done = await isAi8Unlocked(admin, student);
    if (!ai7Done)
      return NextResponse.json(
        { error: "prereq", prereqMessage: "Complete AI 7: Foundations first." },
        { status: 402 },
      );
  } else {
    // L8 capstone gates on AI-8 completion.
    const ai8Path = await getAICoursePath(admin, student, "ai8");
    const ai8Done =
      ai8Path.unlocked &&
      ai8Path.totalPassages > 0 &&
      ai8Path.passedPassages >= ai8Path.totalPassages;
    if (!ai8Done)
      return NextResponse.json(
        { error: "prereq", prereqMessage: "Complete AI 8: Builds On first." },
        { status: 402 },
      );
  }

  const isParent = access.role === "parent";
  const result = await getOrCreateCapstone(admin, studentId, capstoneLevel, isParent);

  return NextResponse.json(result);
}
