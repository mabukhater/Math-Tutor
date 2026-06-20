import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveStudent } from "@/lib/access";
import { getReadingPath } from "@/lib/readingServer";
import { gradeLabel } from "@/lib/curriculum";
import { Check, Lock } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ReadingPage({
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
          <Link href={isKid ? "/me" : "/dashboard"} className="muted">
            {isKid ? "Home" : "Dashboard"}
          </Link>
        </div>
        <p className="sub">
          {label} reading level — read each passage, then answer. Pass at {path.threshold}% to
          unlock the next, harder one.
        </p>

        {(() => {
          const total = path.passages.length;
          const passed = path.passages.filter((p) => p.status === "passed").length;
          const pct = total ? Math.round((100 * passed) / total) : 0;
          if (total === 0)
            return (
              <p className="muted" style={{ marginTop: "1rem" }}>
                No reading passages at this level yet. Check back soon.
              </p>
            );
          return (
            <>
              <div className="ladder-head">
                <div className="ladder-head-row">
                  <span className="ladder-trophy" aria-hidden="true">📚</span>
                  <div style={{ flex: 1 }}>
                    <div className="ladder-head-title">
                      {passed} of {total} passages read
                    </div>
                    <div className="ladder-bar">
                      <div style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="ladder-pct">{pct}%</span>
                </div>
                <p className="ladder-cheer">
                  {passed === total ? "All read! 🎉" : "Keep reading — level up!"}
                </p>
              </div>

              <div className="ladder">
                {path.passages.map((p, i) => (
                  <div key={p.passageId} className={"rung " + p.status}>
                    <div className="rung-node">
                      {p.status === "passed" ? (
                        <Check size={22} />
                      ) : p.status === "locked" ? (
                        <Lock size={16} />
                      ) : (
                        <span>{i + 1}</span>
                      )}
                    </div>
                    <div className="rung-info">
                      <div className="rung-name">{p.title}</div>
                      {p.status === "active" && (
                        <Link
                          href={`/reading/${studentId}/passage/${p.passageId}`}
                          className="rung-go"
                        >
                          ▶ Read &amp; answer
                        </Link>
                      )}
                      {p.status === "passed" && (
                        <div className="rung-meta">
                          Done{p.accuracy != null ? ` · ${p.accuracy}%` : ""}
                        </div>
                      )}
                      {p.status === "locked" && <div className="rung-meta">Locked</div>}
                    </div>
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
