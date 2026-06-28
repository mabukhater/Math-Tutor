import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudent } from "@/lib/access";

// POST /api/capstone/attest
// PARENT ONLY — sets capstone.completed_at after verifying all milestones are
// complete and inserts a capstone_attestations row.
//
// Enforcement points (reviewer must verify):
//   1. resolveStudent returns the resolved access object.
//   2. access.role === "parent" check → 403 for any kid session (AC-6.4, OQ-5).
//   3. All milestone completeness checked server-side before writing.
//   4. Admin client writes (no INSERT RLS — kid token can't bypass, OQ-5).
//   5. Idempotent-ish: second call → 409 (already attested, AC-6.3).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { studentId, level, note } = (body ?? {}) as {
    studentId?: string;
    level?: number;
    note?: string;
  };

  if (!studentId || (level !== 7 && level !== 8))
    return NextResponse.json({ error: "bad request" }, { status: 400 });

  const supabase = await createClient();
  const admin = createAdminClient();
  const access = await resolveStudent(supabase, admin, studentId);
  if (!access) return NextResponse.json({ error: "not found" }, { status: 404 });

  // CRITICAL role check — parent only (AC-6.4, OQ-5).
  if (access.role !== "parent")
    return NextResponse.json({ error: "parent_only" }, { status: 403 });

  const parentId = access.student.parent_id; // always the same user when role==="parent"

  // Find the capstone.
  const { data: capstone } = await admin
    .from("capstones")
    .select("id, completed_at")
    .eq("student_id", studentId)
    .eq("level", level)
    .maybeSingle();
  if (!capstone) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Idempotent guard: already attested → 409.
  if (capstone.completed_at !== null)
    return NextResponse.json({ error: "already_complete" }, { status: 409 });

  // Verify all milestones are submitted (server-side completeness check).
  const { data: milestoneRows } = await admin
    .from("capstone_milestones")
    .select("id, slug, submitted_at")
    .eq("capstone_id", capstone.id);
  const rows = milestoneRows ?? [];
  if (rows.length === 0) return NextResponse.json({ error: "no_milestones" }, { status: 409 });

  // Load templates to check artifact requirements.
  const { data: templates } = await admin
    .from("capstone_milestone_templates")
    .select("slug, requirement")
    .eq("level", level);
  const reqBySlug = new Map(
    ((templates ?? []) as { slug: string; requirement: { requiresArtifact: boolean; allowedKinds: string[]; minCount: number } }[]).map(
      (t) => [t.slug, t.requirement],
    ),
  );

  const mIds = rows.map((m) => m.id);
  const { data: artRows } = mIds.length
    ? await admin
        .from("capstone_artifacts")
        .select("milestone_id, kind")
        .in("milestone_id", mIds)
    : { data: [] };
  const artsByMs = new Map<string, { kind: string }[]>();
  for (const a of artRows ?? []) {
    if (!artsByMs.has(a.milestone_id)) artsByMs.set(a.milestone_id, []);
    artsByMs.get(a.milestone_id)!.push(a);
  }

  for (const m of rows) {
    if (!m.submitted_at)
      return NextResponse.json({ error: "milestones_incomplete" }, { status: 409 });
    const req = reqBySlug.get(m.slug);
    if (req?.requiresArtifact) {
      const arts = artsByMs.get(m.id) ?? [];
      const qualifying = arts.filter((a) => req.allowedKinds.includes(a.kind));
      if (qualifying.length < req.minCount)
        return NextResponse.json({ error: "milestones_incomplete" }, { status: 409 });
    }
  }

  // Write attestation and set completed_at — both via admin client (AC-6.4).
  const now = new Date().toISOString();
  const { error: attestError } = await admin.from("capstone_attestations").insert({
    capstone_id: capstone.id,
    parent_id: parentId,
    attested_at: now,
    note: note ?? null,
  });
  if (attestError)
    return NextResponse.json({ error: attestError.message }, { status: 500 });

  await admin
    .from("capstones")
    .update({ completed_at: now })
    .eq("id", capstone.id);

  return NextResponse.json({ ok: true, completedAt: now });
}
