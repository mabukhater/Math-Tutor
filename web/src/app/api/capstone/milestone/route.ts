import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudent } from "@/lib/access";
import { submitMilestone } from "@/lib/capstoneServer";
import type { Rubric } from "@/lib/capstoneTypes";

// POST /api/capstone/milestone
// Submit (complete) a milestone. Enforces sequential unlock (AC-4.3) and
// artifact requirement (AC-4.4) server-side. Stores rubric for "reflect" (AC-4.5).
//
// Auth: parent or linked kid (resolveStudent → 404 if not owned).
// Does NOT set capstone.completed_at — that is parent attestation only (AC-6.2).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const {
    studentId,
    level,
    slug,
    rubric,
  } = (body ?? {}) as {
    studentId?: string;
    level?: number;
    slug?: string;
    rubric?: Rubric;
  };

  if (!studentId || (level !== 7 && level !== 8) || !slug)
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const VALID_SLUGS = ["idea", "plan", "build_v1", "test_feedback", "ship", "reflect"];
  if (!VALID_SLUGS.includes(slug))
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const supabase = await createClient();
  const admin = createAdminClient();
  const access = await resolveStudent(supabase, admin, studentId);
  if (!access) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Find the capstone row for this student + level.
  const { data: capstone } = await admin
    .from("capstones")
    .select("id")
    .eq("student_id", studentId)
    .eq("level", level)
    .maybeSingle();
  if (!capstone) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const result = await submitMilestone(admin, capstone.id, slug, rubric);
    return NextResponse.json({ ok: true, milestone: result });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "locked" || code === "missing_artifact") {
      return NextResponse.json({ error: code }, { status: 409 });
    }
    throw err;
  }
}
