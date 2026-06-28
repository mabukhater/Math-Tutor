import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudent } from "@/lib/access";
import { getAICoursePath } from "@/lib/readingServer";
import { Check } from "@/components/icons";

export const dynamic = "force-dynamic";

// The AI 7 course ladder. Reuses the Reading ladder UI and conventions.
// Shows weeks 1–12 of AI 7 with the same first-incomplete-wins status logic.
export default async function AI7Page({
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

  const path = await getAICoursePath(admin, student, "ai7");

  const ai7Done =
    path.totalPassages > 0 && path.passedPassages >= path.totalPassages;

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="row" style={{ marginBottom: "0.25rem" }}>
          <h1 style={{ margin: 0 }}>
            {student.display_name ? `${student.display_name}'s` : ""} AI 7: Foundations
          </h1>
          <Link href={isKid ? "/me" : "/dashboard"} className="muted home-link">
            {isKid ? "← Home" : "Dashboard"}
          </Link>
        </div>
        <p className="sub">
          12-week AI literacy course — read each lesson, then answer. Pass at {path.threshold}%.
          Tap any lesson to start.
        </p>

        {/* Course-complete CTA (AC-2.5) */}
        {ai7Done && (
          <div className="ladder-head clay" style={{ background: "var(--amber-10, #fff8e1)" }}>
            <p style={{ margin: 0, fontWeight: 700 }}>
              Course complete! 🎉 You&apos;ve finished AI 7: Foundations.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
              <Link href={`/ai/${studentId}/capstone/7`} className="btn">
                Start Level 7 Capstone →
              </Link>
              <Link href={`/ai/${studentId}/ai8`} className="btn" style={{ background: "transparent", border: "1px solid currentColor" }}>
                AI 8: Builds On →
              </Link>
            </div>
          </div>
        )}

        {(() => {
          const { totalPassages: total, passedPassages: passed } = path;
          const pct = total ? Math.round((100 * passed) / total) : 0;
          if (total === 0)
            return (
              <p className="muted" style={{ marginTop: "1rem" }}>
                No AI 7 lessons published yet. Check back soon.
              </p>
            );
          return (
            <>
              {!ai7Done && (
                <div className="ladder-head clay">
                  <div className="ladder-head-row">
                    <span className="ladder-trophy" aria-hidden="true">🤖</span>
                    <div style={{ flex: 1 }}>
                      <div className="ladder-head-title">
                        {passed} of {total} lessons read
                      </div>
                      <div className="ladder-bar">
                        <div style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="ladder-pct">{pct}%</span>
                  </div>
                  <p className="ladder-cheer">Keep going — each lesson unlocks the next!</p>
                </div>
              )}

              <div className="ladder clay-ladder">
                {path.weeks.map((wk) => (
                  <div key={wk.week} className="ladder-month">
                    <div className="ladder-month-banner clay-banner">
                      📖 Week {wk.week} · {wk.passed}/{wk.total} lessons
                    </div>
                    {wk.passages.map((p, i) => (
                      <Link
                        key={p.passageId}
                        href={`/ai/${studentId}/passage/${p.passageId}?subject=ai7`}
                        className={"rung clay-rung " + p.status}
                      >
                        <div className="rung-node">
                          {p.status === "passed" ? <Check size={22} /> : <span>{i + 1}</span>}
                        </div>
                        <div className="rung-info">
                          <div className="rung-name">{p.title}</div>
                          <div className="rung-meta">
                            {p.status === "passed"
                              ? `Done${p.accuracy != null ? ` · ${p.accuracy}%` : ""} · Read again`
                              : p.status === "active"
                                ? "▶ Read & answer"
                                : "Read →"}
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
