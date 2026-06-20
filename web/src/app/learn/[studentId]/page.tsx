import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPathForStudent } from "@/lib/pathServer";
import { gradeLabel } from "@/lib/curriculum";
import { Check, Lock } from "@/components/icons";
import { ThresholdControl } from "@/components/ThresholdControl";

export const dynamic = "force-dynamic";

export default async function LearnPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: student } = await supabase
    .from("students")
    .select("id, curriculum_id, nominal_grade, current_skill_index, pass_threshold, display_name, placement_completed")
    .eq("id", studentId)
    .single();
  if (!student) notFound();
  if (!student.placement_completed) redirect(`/placement/${studentId}`);

  const admin = createAdminClient();
  const path = await getPathForStudent(admin, student);
  const { data: cur } = await admin
    .from("curricula")
    .select("code, name, grade_noun, grade_offset")
    .eq("id", student.curriculum_id)
    .single();
  const label = gradeLabel(cur?.grade_noun, cur?.grade_offset, student.nominal_grade, cur?.code);

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="row" style={{ marginBottom: "0.25rem" }}>
          <h1 style={{ margin: 0 }}>
            {student.display_name ? `${student.display_name}’s path` : "Learning path"}
          </h1>
          <Link href="/dashboard" className="muted">
            Dashboard
          </Link>
        </div>
        <p className="sub">
          {label} · {cur?.name} — pass each week at {path.threshold}% to unlock the next.
        </p>

        <ThresholdControl studentId={studentId} value={path.threshold} />

        {path.months.length === 0 ? (
          <p className="muted" style={{ marginTop: "1rem" }}>
            No path content at this level yet. Check back soon.
          </p>
        ) : (
          <div className="path">
            {path.months.map((m, mi) => (
              <div key={m.topicCode} className="path-month">
                <div className="path-month-label">Month {mi + 1} · {m.topicName}</div>
                {m.weeks.map((w, wi) => (
                  <div key={w.skillId} className={"path-week " + w.status}>
                    <div className="path-node">
                      {w.status === "passed" ? (
                        <Check size={16} />
                      ) : w.status === "locked" ? (
                        <Lock size={14} />
                      ) : (
                        <span className="path-dot" />
                      )}
                    </div>
                    <div className="path-week-body">
                      <div className="path-week-name">
                        Week {wi + 1} · {w.name}
                      </div>
                      {w.status === "active" && (
                        <Link href={`/learn/${studentId}/week/${w.skillId}`} className="btn path-start">
                          Read lesson &amp; start
                        </Link>
                      )}
                    </div>
                    <div className="path-week-meta">
                      {w.status === "passed"
                        ? `Passed${w.accuracy != null ? ` · ${w.accuracy}%` : ""}`
                        : w.status === "locked"
                          ? "Locked"
                          : "This week"}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
