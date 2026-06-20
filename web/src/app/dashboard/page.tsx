import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureParent } from "@/lib/parents";
import { isAdminEmail } from "@/lib/adminAuth";
import { gradeLabel } from "@/lib/curriculum";
import { currentKidStudentId } from "@/lib/access";
import { getPathForStudent } from "@/lib/pathServer";
import { getReadingPath } from "@/lib/readingServer";
import { ThresholdControl } from "@/components/ThresholdControl";
import { KidLoginManager } from "@/components/KidLoginManager";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function curField(c: any, f: string) {
  return Array.isArray(c) ? c[0]?.[f] : c?.[f];
}

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  // A kid who reaches the dashboard is sent to their own home.
  if (await currentKidStudentId(supabase, admin)) redirect("/me");
  await ensureParent(supabase, user);

  const { data: students } = await supabase
    .from("students")
    .select(
      "id, display_name, nominal_grade, placement_completed, current_skill_index, pass_threshold, curriculum_id, curricula(code, name, grade_noun, grade_offset)",
    )
    .order("created_at", { ascending: true });

  const list = students ?? [];
  const ids = list.map((s) => s.id);
  const { data: kidLogins } = ids.length
    ? await admin.from("kid_logins").select("student_id, username").in("student_id", ids)
    : { data: [] };
  const usernameBy = new Map(
    (kidLogins ?? []).map((k) => [k.student_id as string, k.username as string]),
  );

  const summaries = new Map<string, { math: { passed: number; total: number } | null; reading: { passed: number; total: number } }>();
  for (const s of list) {
    const stud = {
      id: s.id,
      curriculum_id: s.curriculum_id,
      nominal_grade: s.nominal_grade,
      current_skill_index: s.current_skill_index,
      pass_threshold: s.pass_threshold,
    };
    let math: { passed: number; total: number } | null = null;
    if (s.placement_completed) {
      const path = await getPathForStudent(admin, stud);
      const weeks = path.months.flatMap((m) => m.weeks);
      math = { passed: weeks.filter((w) => w.status === "passed").length, total: weeks.length };
    }
    const rp = await getReadingPath(admin, stud);
    summaries.set(s.id, {
      math,
      reading: { passed: rp.passages.filter((p) => p.status === "passed").length, total: rp.passages.length },
    });
  }

  return (
    <div className="wrap">
      <div className="card">
        <div className="row" style={{ marginBottom: "1rem" }}>
          <h1 style={{ margin: 0 }}>Your children</h1>
          <form action="/auth/signout" method="post">
            <button className="muted" style={{ background: "none", border: "none", cursor: "pointer" }}>
              Sign out
            </button>
          </form>
        </div>

        {list.length === 0 && (
          <p className="sub">No children yet. Add one to run the placement check.</p>
        )}

        {list.map((s) => {
          const sum = summaries.get(s.id);
          return (
            <div className="list-item" key={s.id}>
              <div className="row">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div className="avatar">{s.display_name.charAt(0).toUpperCase()}</div>
                  <div>
                    <Link href={`/children/${s.id}`}>
                      <strong>{s.display_name}</strong>
                    </Link>{" "}
                    <span className="muted">
                      {gradeLabel(
                        curField(s.curricula, "grade_noun"),
                        curField(s.curricula, "grade_offset"),
                        s.nominal_grade,
                        curField(s.curricula, "code"),
                      )}
                    </span>
                    <div className="muted" style={{ fontSize: "0.82rem" }}>
                      {sum?.math
                        ? `Math: ${sum.math.passed}/${sum.math.total} weeks`
                        : "Math: placement not done"}
                      {" · "}
                      Reading: {sum?.reading.passed ?? 0}/{sum?.reading.total ?? 0} passages
                    </div>
                  </div>
                </div>
                {s.placement_completed ? (
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <Link href={`/learn/${s.id}`} className="badge">
                      Math
                    </Link>
                    <Link href={`/reading/${s.id}`} className="badge">
                      Reading
                    </Link>
                    <Link href={`/practice/${s.id}/topics`} className="badge-soft">
                      Topics
                    </Link>
                  </div>
                ) : (
                  <Link href={`/placement/${s.id}`} className="badge">
                    Run placement
                  </Link>
                )}
              </div>

              <div className="child-controls">
                <ThresholdControl studentId={s.id} value={s.pass_threshold} />
                <KidLoginManager studentId={s.id} username={usernameBy.get(s.id) ?? null} />
              </div>
            </div>
          );
        })}

        <Link href="/children/new" className="btn" style={{ marginTop: "1.25rem" }}>
          Add a child
        </Link>

        {isAdminEmail(user.email) && (
          <p style={{ marginTop: "1rem", textAlign: "center" }}>
            <Link href="/vet" className="muted">
              Admin · vet questions →
            </Link>{" "}
            ·{" "}
            <Link href="/early/results" className="muted">
              waitlist results →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
