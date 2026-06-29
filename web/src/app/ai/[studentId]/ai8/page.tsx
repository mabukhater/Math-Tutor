import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudent } from "@/lib/access";
import { getAICoursePath } from "@/lib/readingServer";
import { Check } from "@/components/icons";

export const dynamic = "force-dynamic";

// The AI 8 course ladder. Locked until AI-7 is complete (AC-3.1).
// Reuses the Reading ladder UI conventions.
export default async function AI8Page({
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

  // getAICoursePath computes the unlock state server-side (AC-3.2).
  const path = await getAICoursePath(admin, student, "ai8");

  const ai8Done =
    path.unlocked &&
    path.totalPassages > 0 &&
    path.passedPassages >= path.totalPassages;

  // Locked state — AC-3.1
  if (!path.unlocked) {
    return (
      <div className="wrap">
        <div className="card" style={{ maxWidth: 720 }}>
          <div className="row" style={{ marginBottom: "0.25rem" }}>
            <h1 style={{ margin: 0 }}>AI 8: Builds On</h1>
            <Link href={isKid ? "/me" : "/dashboard"} className="muted home-link">
              {isKid ? "← Home" : "Dashboard"}
            </Link>
          </div>
          <div className="ladder-head clay" style={{ marginTop: "1rem" }}>
            <p style={{ margin: 0, fontWeight: 700 }}>🔒 {path.prereqMessage}</p>
            <Link href={`/ai/${studentId}`} className="btn" style={{ marginTop: "0.75rem" }}>
              Go to AI 7: Foundations →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="row" style={{ marginBottom: "0.25rem" }}>
          <h1 style={{ margin: 0 }}>
            {student.display_name ? `${student.display_name}'s` : ""} AI 8: Builds On
          </h1>
          <Link href={isKid ? "/me" : "/dashboard"} className="muted home-link">
            {isKid ? "← Home" : "Dashboard"}
          </Link>
        </div>
        <p className="sub">
          12-week advanced AI course — lessons 13–24. Read each passage, then answer. Pass at{" "}
          {path.threshold}%.
        </p>

        {/* Course-complete CTA (AC-2.5 for AI-8) */}
        {ai8Done && (
          <div className="ladder-head clay" style={{ background: "var(--amber-10, #fff8e1)" }}>
            <p style={{ margin: 0, fontWeight: 700 }}>
              Course complete! 🎉 You&apos;ve finished AI 8: Builds On.
            </p>
            <Link href={`/ai/${studentId}/capstone/8`} className="btn" style={{ marginTop: "0.75rem" }}>
              Start Level 8 Capstone →
            </Link>
          </div>
        )}

        {(() => {
          const { totalPassages: total, passedPassages: passed } = path;
          const pct = total ? Math.round((100 * passed) / total) : 0;
          if (total === 0)
            return (
              <p className="muted" style={{ marginTop: "1rem" }}>
                No AI 8 lessons published yet. Check back soon.
              </p>
            );
          return (
            <>
              {!ai8Done && (
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
                        href={`/ai/${studentId}/passage/${p.passageId}?subject=ai8`}
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
