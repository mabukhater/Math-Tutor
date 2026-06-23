import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudent } from "@/lib/access";
import { getPathForStudent } from "@/lib/pathServer";
import { gradeLabel } from "@/lib/curriculum";
import { Check } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function LearnPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  const access = await resolveStudent(supabase, admin, studentId);
  if (!access) redirect("/login");
  const student = access.student;
  const isKid = access.role === "kid";
  if (!student.placement_completed) redirect(isKid ? "/me" : `/placement/${studentId}`);

  const path = await getPathForStudent(admin, student);
  const { data: cur } = await admin
    .from("curricula")
    .select("code, name, grade_noun, grade_offset")
    .eq("id", student.curriculum_id)
    .single();
  const label = gradeLabel(cur?.grade_noun, cur?.grade_offset, path.effectiveGrade, cur?.code);

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="row" style={{ marginBottom: "0.25rem" }}>
          <h1 style={{ margin: 0 }}>
            {student.display_name ? `${student.display_name}’s path` : "Learning path"}
          </h1>
          <Link href={isKid ? "/me" : "/dashboard"} className="muted home-link">
            {isKid ? "← Home" : "Dashboard"}
          </Link>
        </div>
        <p className="sub">
          {label} · {cur?.name} — pass each week at {path.threshold}%. Tap any week to start it.
        </p>

        {(() => {
          const allWeeks = path.months.flatMap((m) => m.weeks);
          const total = allWeeks.length;
          const passed = allWeeks.filter((w) => w.status === "passed").length;
          const pct = total ? Math.round((100 * passed) / total) : 0;
          if (total === 0)
            return (
              <p className="muted" style={{ marginTop: "1rem" }}>
                No lessons at this level yet. Check back soon.
              </p>
            );
          return (
            <>
              <div className="ladder-head clay">
                <div className="ladder-head-row">
                  <span className="ladder-trophy" aria-hidden="true">🏆</span>
                  <div style={{ flex: 1 }}>
                    <div className="ladder-head-title">
                      {passed} of {total} lessons done
                    </div>
                    <div className="ladder-bar">
                      <div style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="ladder-pct">{pct}%</span>
                </div>
                <p className="ladder-cheer">
                  {passed === total ? "You did it all! 🎉" : "Keep climbing — you’ve got this!"}
                </p>
              </div>

              <div className="ladder clay-ladder">
                {path.months.map((m) => (
                  <div key={m.topicCode} className="ladder-month">
                    <div className="ladder-month-banner clay-banner">📘 {m.topicName}</div>
                    {m.weeks.map((w, wi) => (
                      <Link
                        key={w.skillId}
                        href={`/learn/${studentId}/week/${w.skillId}`}
                        className={"rung clay-rung " + w.status}
                      >
                        <div className="rung-node">
                          {w.status === "passed" ? <Check size={22} /> : <span>{wi + 1}</span>}
                        </div>
                        <div className="rung-info">
                          <div className="rung-name">{w.name}</div>
                          <div className="rung-meta">
                            {w.status === "passed"
                              ? `Done${w.accuracy != null ? ` · ${w.accuracy}%` : ""} · Practice again`
                              : w.status === "active"
                                ? "▶ Start this lesson"
                                : "Start →"}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
