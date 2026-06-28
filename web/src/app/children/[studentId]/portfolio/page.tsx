import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudent } from "@/lib/access";
import { getOrCreateCapstone } from "@/lib/capstoneServer";
import type { Attestation } from "@/lib/capstoneTypes";

// Designer-owned component (named export, per the designer's implementation).
import { PortfolioCapstoneCard } from "@/components/portfolio/PortfolioCapstoneCard";

export const dynamic = "force-dynamic";

// /children/[studentId]/portfolio
// Private portfolio — shows completed capstones for this student.
//
// AC-7.3: returns 404 (not 403) for a student the caller doesn't own.
// AC-7.2: only capstones belonging to the student are shown.
// AC-7.4: file artifact URLs are short-TTL signed URLs from getOrCreateCapstone.
export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;

  const supabase = await createClient();
  const admin = createAdminClient();
  const access = await resolveStudent(supabase, admin, studentId);
  // AC-7.3: 404 not 403 — don't confirm the student's existence to a stranger.
  if (!access) notFound();

  const student = access.student;
  const isParent = access.role === "parent";

  // Query only capstones that exist (don't lazy-create from portfolio page —
  // the student must have opened the capstone page first).
  const { data: capstoneRows } = await admin
    .from("capstones")
    .select("id, level, completed_at")
    .eq("student_id", studentId)
    .order("level", { ascending: true });

  const existingLevels = (capstoneRows ?? []) as {
    id: string;
    level: number;
    completed_at: string | null;
  }[];

  // For each existing capstone, load full milestone + artifact + attestation data.
  const capstoneData = await Promise.all(
    existingLevels.map(async (c) => {
      const level = c.level === 7 ? "l7" as const : "l8" as const;
      const result = await getOrCreateCapstone(admin, studentId, level, isParent);
      const attestation: Attestation = result.attestation;
      return {
        level: c.level,
        completedAt: c.completed_at,
        milestones: result.milestones,
        attestation,
      };
    }),
  );

  // Only show completed capstones in the portfolio (AC-4.7, AC-5.5).
  const completedCapstones = capstoneData.filter((c) => c.completedAt !== null);

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="row" style={{ marginBottom: "0.5rem" }}>
          <h1 style={{ margin: 0 }}>
            {student.display_name ? `${student.display_name}'s` : ""} Portfolio
          </h1>
          <Link href={`/children/${studentId}`} className="muted home-link">
            Back
          </Link>
        </div>
        <p className="sub">
          Completed capstone projects — visible only to{" "}
          {student.display_name ?? "this student"} and their parent.
        </p>

        {completedCapstones.length === 0 ? (
          <p className="muted" style={{ marginTop: "1rem" }}>
            No completed capstones yet. Complete AI 7 and start the Level 7 capstone.
          </p>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginTop: "1rem" }}
          >
            {completedCapstones.map((c) => (
              <PortfolioCapstoneCard
                key={c.level}
                capstone={{
                  level: c.level,
                  // PortfolioCapstoneCard declares completedAt: string (non-nullable)
                  // We only render completed capstones so this cast is safe.
                  completedAt: c.completedAt!,
                }}
                milestones={c.milestones}
                attestation={c.attestation}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
