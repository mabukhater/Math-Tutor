import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReadingPath } from "@/lib/readingServer";
import { gradeLabel } from "@/lib/curriculum";
import { Check, Lock } from "@/components/icons";
import { ThresholdControl } from "@/components/ThresholdControl";

export const dynamic = "force-dynamic";

export default async function ReadingPage({
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
    .select("id, nominal_grade, pass_threshold, display_name, curriculum_id")
    .eq("id", studentId)
    .single();
  if (!student) notFound();

  const admin = createAdminClient();
  const path = await getReadingPath(admin, student);
  const { data: cur } = await admin
    .from("curricula")
    .select("code, grade_noun, grade_offset")
    .eq("id", student.curriculum_id)
    .single();
  const label = gradeLabel(cur?.grade_noun, cur?.grade_offset, student.nominal_grade, cur?.code);

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="row" style={{ marginBottom: "0.25rem" }}>
          <h1 style={{ margin: 0 }}>
            {student.display_name ? `${student.display_name}’s reading` : "Reading"}
          </h1>
          <Link href="/dashboard" className="muted">
            Dashboard
          </Link>
        </div>
        <p className="sub">
          {label} reading level — read each passage, then answer. Pass at {path.threshold}% to
          unlock the next, harder one.
        </p>

        <ThresholdControl studentId={studentId} value={path.threshold} />

        {path.passages.length === 0 ? (
          <p className="muted" style={{ marginTop: "1rem" }}>
            No reading passages at this level yet. Check back soon.
          </p>
        ) : (
          <div className="path" style={{ marginTop: "1.25rem" }}>
            {path.passages.map((p, i) => (
              <div key={p.passageId} className={"path-week " + p.status}>
                <div className="path-node">
                  {p.status === "passed" ? (
                    <Check size={16} />
                  ) : p.status === "locked" ? (
                    <Lock size={14} />
                  ) : (
                    <span className="path-dot" />
                  )}
                </div>
                <div className="path-week-body">
                  <div className="path-week-name">
                    Level {i + 1} · {p.title}
                  </div>
                  {p.status === "active" && (
                    <Link
                      href={`/reading/${studentId}/passage/${p.passageId}`}
                      className="btn path-start"
                    >
                      Read &amp; answer
                    </Link>
                  )}
                </div>
                <div className="path-week-meta">
                  {p.status === "passed"
                    ? `Passed${p.accuracy != null ? ` · ${p.accuracy}%` : ""}`
                    : p.status === "locked"
                      ? "Locked"
                      : "Up next"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
