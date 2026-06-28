/**
 * Shared server-side logic for the capstone subsystem.
 *
 * Pattern matches readingServer.ts: admin (service-role) client for all
 * privileged reads/writes; resolveStudent handles auth gating at the route level.
 *
 * Child-safety notes (reviewer):
 *   AC-8.1/8.2/8.3 — no LLM call, no generated text; all content is static
 *                     capstone_milestone_templates rows rendered verbatim.
 *   AC-7.4          — file artifacts are served as short-TTL signed URLs only.
 *   AC-6.4/OQ-5     — attestation role check is enforced in the route, not here.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Artifact,
  Attestation,
  CapstoneArtifactRow,
  CapstoneLevel,
  CapstoneRequirement,
  CapstoneRow,
  CapstoneMilestoneRow,
  CapstoneMilestoneTemplateRow,
  KitContent,
  Milestone,
  MilestoneStatus,
  Rubric,
} from "./capstoneTypes";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Map CapstoneLevel ("l7"|"l8") to the integer stored in the DB (7|8). */
function levelInt(level: CapstoneLevel): 7 | 8 {
  return level === "l7" ? 7 : 8;
}

/**
 * Compute MilestoneStatus from the first-incomplete-wins algorithm (AC-4.3).
 * Matches the same mental model as the reading ladder.
 *
 * A milestone is "complete" when submitted_at IS NOT NULL AND the artifact set
 * satisfies its requirement. Status is computed, never stored.
 */
function computeMilestoneStatus(
  m: CapstoneMilestoneRow,
  artifacts: CapstoneArtifactRow[],
  req: CapstoneRequirement,
  activeFound: { value: boolean },
): MilestoneStatus {
  const hasSubmitted = m.submitted_at !== null;
  const artifactsSatisfied =
    !req.requiresArtifact ||
    artifacts.filter((a) => req.allowedKinds.includes(a.kind)).length >= req.minCount;

  if (hasSubmitted && artifactsSatisfied) return "complete";

  // Not yet complete — is this the first one?
  if (!activeFound.value) {
    activeFound.value = true;
    return "active";
  }
  return "locked";
}

/** Convert a CapstoneArtifactRow to the Artifact shape the client receives. */
async function rowToArtifact(
  admin: SupabaseClient,
  row: CapstoneArtifactRow,
): Promise<Artifact> {
  const base: Artifact = { id: row.id, kind: row.kind };
  if (row.kind === "url") {
    base.url = row.url ?? undefined;
  } else if (row.kind === "text") {
    base.bodyText = row.body_text ?? undefined;
  } else if (row.kind === "file" && row.storage_path) {
    // Mint a 60-minute signed URL for file artifacts (AC-7.4).
    const { data: signed } = await admin.storage
      .from("capstone-artifacts")
      .createSignedUrl(row.storage_path, 3600);
    base.signedUrl = signed?.signedUrl ?? undefined;
    base.mime = row.mime ?? undefined;
  }
  return base;
}

// ---------------------------------------------------------------------------
// Public API used by route handlers
// ---------------------------------------------------------------------------

export interface CapstoneReadResult {
  capstone: { id: string; level: CapstoneLevel; completedAt: string | null };
  milestones: Milestone[];
  attestation: Attestation;
  canAttest: boolean;
  isParent: boolean;
}

/**
 * Lazy-create the capstones row + its 6 capstone_milestones rows on first access,
 * then return milestones with computed status and artifacts (signed URLs for files).
 *
 * This is the main read path for the capstone page (AC-4.1, AC-5.1).
 */
export async function getOrCreateCapstone(
  admin: SupabaseClient,
  studentId: string,
  level: CapstoneLevel,
  isParent: boolean,
): Promise<CapstoneReadResult> {
  const dbLevel = levelInt(level);

  // 1. Lazy-create the capstones row (mirrors getOrCreateReadingBlock pattern).
  let capstone: CapstoneRow;
  {
    const { data: existing } = await admin
      .from("capstones")
      .select("id, student_id, level, created_at, completed_at")
      .eq("student_id", studentId)
      .eq("level", dbLevel)
      .maybeSingle();

    if (existing) {
      capstone = existing as CapstoneRow;
    } else {
      const { data: created, error } = await admin
        .from("capstones")
        .insert({ student_id: studentId, level: dbLevel })
        .select("id, student_id, level, created_at, completed_at")
        .single();
      if (error || !created) throw new Error(error?.message ?? "capstone_create_failed");
      capstone = created as CapstoneRow;
    }
  }

  // 2. Fetch templates for this level (static shared copy — OQ-8).
  const { data: templates } = await admin
    .from("capstone_milestone_templates")
    .select("id, level, slug, position, title, description, requirement, content")
    .eq("level", dbLevel)
    .order("position", { ascending: true });
  const tplList = (templates ?? []) as CapstoneMilestoneTemplateRow[];
  const tplBySlug = new Map(tplList.map((t) => [t.slug, t]));

  // 3. Lazy-create per-student milestone rows (progress only).
  const { data: existingMs } = await admin
    .from("capstone_milestones")
    .select("id, capstone_id, slug, position, submitted_at, rubric, created_at")
    .eq("capstone_id", capstone.id)
    .order("position", { ascending: true });
  let milestoneRows: CapstoneMilestoneRow[];

  if ((existingMs ?? []).length < tplList.length) {
    // Some (or all) milestones don't exist yet — create the missing ones.
    const existingSlugs = new Set((existingMs ?? []).map((m) => (m as CapstoneMilestoneRow).slug));
    const toInsert = tplList
      .filter((t) => !existingSlugs.has(t.slug))
      .map((t) => ({
        capstone_id: capstone.id,
        slug: t.slug,
        position: t.position,
      }));
    if (toInsert.length > 0) {
      await admin.from("capstone_milestones").insert(toInsert);
    }
    const { data: allMs } = await admin
      .from("capstone_milestones")
      .select("id, capstone_id, slug, position, submitted_at, rubric, created_at")
      .eq("capstone_id", capstone.id)
      .order("position", { ascending: true });
    milestoneRows = (allMs ?? []) as CapstoneMilestoneRow[];
  } else {
    milestoneRows = (existingMs ?? []) as CapstoneMilestoneRow[];
  }

  // 4. Fetch all artifacts for all milestones in one query.
  const milestoneIds = milestoneRows.map((m) => m.id);
  const { data: artifactRows } = milestoneIds.length
    ? await admin
        .from("capstone_artifacts")
        .select("id, milestone_id, kind, url, body_text, storage_path, mime, created_at")
        .in("milestone_id", milestoneIds)
    : { data: [] };
  const artsByMilestone = new Map<string, CapstoneArtifactRow[]>();
  for (const a of (artifactRows ?? []) as CapstoneArtifactRow[]) {
    if (!artsByMilestone.has(a.milestone_id)) artsByMilestone.set(a.milestone_id, []);
    artsByMilestone.get(a.milestone_id)!.push(a);
  }

  // 5. Fetch attestation.
  const { data: attestRow } = await admin
    .from("capstone_attestations")
    .select("id, capstone_id, parent_id, attested_at, note")
    .eq("capstone_id", capstone.id)
    .maybeSingle();

  const attestation: Attestation = attestRow
    ? {
        parentId: attestRow.parent_id as string,
        attestedAt: attestRow.attested_at as string,
        note: (attestRow.note as string | null) ?? undefined,
      }
    : null;

  // 6. Compute milestone status (first-incomplete-wins, AC-4.3).
  const activeFound = { value: false };
  const milestones: Milestone[] = await Promise.all(
    milestoneRows.map(async (m) => {
      const tpl = tplBySlug.get(m.slug);
      const req: CapstoneRequirement = tpl?.requirement ?? {
        requiresArtifact: false,
        allowedKinds: [],
        minCount: 0,
      };
      const arts = artsByMilestone.get(m.id) ?? [];
      const status = computeMilestoneStatus(m, arts, req, activeFound);
      const artifacts = await Promise.all(arts.map((a) => rowToArtifact(admin, a)));
      return {
        id: m.id,
        position: m.position,
        slug: m.slug,
        title: tpl?.title ?? m.slug,
        status,
        submittedAt: m.submitted_at,
        requirement: req,
        content: (tpl?.content as KitContent | null) ?? null,
        artifacts,
        rubric: m.rubric ?? null,
      };
    }),
  );

  // 7. canAttest: all milestones complete AND parent AND not yet attested (AC-6.1).
  const allComplete = milestones.length > 0 && milestones.every((m) => m.status === "complete");
  const canAttest = allComplete && isParent && attestation === null;

  return {
    capstone: {
      id: capstone.id,
      level,
      completedAt: capstone.completed_at,
    },
    milestones,
    attestation,
    canAttest,
    isParent,
  };
}

/**
 * Validate that a milestone's artifact set satisfies its requirement (AC-4.4).
 * Returns null on success, or an error string.
 */
export function validateArtifactRequirement(
  req: CapstoneRequirement,
  artifacts: CapstoneArtifactRow[],
): string | null {
  if (!req.requiresArtifact) return null;
  const qualifying = artifacts.filter((a) => req.allowedKinds.includes(a.kind));
  if (qualifying.length < req.minCount) {
    return "missing_artifact";
  }
  return null;
}

/**
 * Submit (complete) a milestone. Enforces:
 *   - milestone is active (prior one complete or it's milestone 1) — AC-4.3
 *   - artifact requirement satisfied — AC-4.4
 *   - rubric stored for the reflect milestone — AC-4.5
 *
 * Returns { ok: true, slug, status } or throws with an error code string.
 */
export async function submitMilestone(
  admin: SupabaseClient,
  capstoneId: string,
  slug: string,
  rubric?: Rubric,
): Promise<{ slug: string; status: MilestoneStatus }> {
  // Load all milestones ordered by position to determine which is active.
  const { data: allMs } = await admin
    .from("capstone_milestones")
    .select("id, slug, position, submitted_at, rubric")
    .eq("capstone_id", capstoneId)
    .order("position", { ascending: true });
  const rows = (allMs ?? []) as CapstoneMilestoneRow[];

  // Load templates to get requirements.
  const { data: capRow } = await admin
    .from("capstones")
    .select("level")
    .eq("id", capstoneId)
    .single();
  const dbLevel = (capRow?.level as 7 | 8) ?? 7;
  const { data: templates } = await admin
    .from("capstone_milestone_templates")
    .select("slug, position, requirement")
    .eq("level", dbLevel);
  const tplBySlug = new Map(
    ((templates ?? []) as Pick<CapstoneMilestoneTemplateRow, "slug" | "position" | "requirement">[]).map(
      (t) => [t.slug, t],
    ),
  );

  // Determine which slug is the active one right now.
  const milestoneIds = rows.map((m) => m.id);
  const { data: artRows } = milestoneIds.length
    ? await admin
        .from("capstone_artifacts")
        .select("id, milestone_id, kind")
        .in("milestone_id", milestoneIds)
    : { data: [] };
  const artsByMs = new Map<string, CapstoneArtifactRow[]>();
  for (const a of (artRows ?? []) as CapstoneArtifactRow[]) {
    if (!artsByMs.has(a.milestone_id)) artsByMs.set(a.milestone_id, []);
    artsByMs.get(a.milestone_id)!.push(a as CapstoneArtifactRow);
  }

  const activeFound = { value: false };
  let activeMilestone: CapstoneMilestoneRow | null = null;
  for (const m of rows) {
    const req: CapstoneRequirement = tplBySlug.get(m.slug)?.requirement ?? {
      requiresArtifact: false,
      allowedKinds: [],
      minCount: 0,
    };
    const arts = artsByMs.get(m.id) ?? [];
    const status = computeMilestoneStatus(m, arts, req, activeFound);
    if (status === "active" && m.slug === slug) {
      activeMilestone = m;
      break;
    }
  }

  if (!activeMilestone) {
    throw Object.assign(new Error("locked"), { code: "locked" });
  }

  // Check artifact requirement for this milestone.
  const req: CapstoneRequirement = tplBySlug.get(slug)?.requirement ?? {
    requiresArtifact: false,
    allowedKinds: [],
    minCount: 0,
  };
  const arts = artsByMs.get(activeMilestone.id) ?? [];
  const artErr = validateArtifactRequirement(req, arts);
  if (artErr) throw Object.assign(new Error(artErr), { code: artErr });

  // Build the update payload.
  const updatePayload: Record<string, unknown> = {
    submitted_at: new Date().toISOString(),
  };
  if (slug === "reflect" && rubric) {
    updatePayload.rubric = rubric;
  }

  await admin
    .from("capstone_milestones")
    .update(updatePayload)
    .eq("id", activeMilestone.id);

  return { slug, status: "complete" };
}
