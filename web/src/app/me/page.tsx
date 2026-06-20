import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentKidStudentId } from "@/lib/access";
import { getPathForStudent } from "@/lib/pathServer";
import { getReadingPath } from "@/lib/readingServer";
import { ProgressRing } from "@/components/ProgressRing";

export const dynamic = "force-dynamic";

export default async function KidHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/kids");

  const admin = createAdminClient();
  const studentId = await currentKidStudentId(supabase, admin);
  if (!studentId) redirect("/dashboard"); // a parent landed here

  const { data: student } = await admin
    .from("students")
    .select("id, display_name, placement_completed, curriculum_id, nominal_grade, current_skill_index, pass_threshold")
    .eq("id", studentId)
    .single();
  if (!student) redirect("/kids");

  let mathPct = 0;
  let mathLabel = "Ask a grown-up to set up your level";
  if (student.placement_completed) {
    const path = await getPathForStudent(admin, student);
    const weeks = path.months.flatMap((m) => m.weeks);
    const passed = weeks.filter((w) => w.status === "passed").length;
    mathPct = weeks.length ? Math.round((100 * passed) / weeks.length) : 0;
    mathLabel = weeks.length ? `${passed} of ${weeks.length} weeks` : "Coming soon";
  }
  const rp = await getReadingPath(admin, student);
  const readPct = rp.totalPassages ? Math.round((100 * rp.passedPassages) / rp.totalPassages) : 0;
  const readLabel = rp.totalPassages
    ? `${rp.passedPassages} of ${rp.totalPassages} passages`
    : "Coming soon";

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="row" style={{ marginBottom: "0.5rem" }}>
          <h1 style={{ margin: 0 }}>Hi {student.display_name || "there"}! 👋</h1>
          <form action="/auth/signout" method="post">
            <button className="muted" style={{ background: "none", border: "none", cursor: "pointer" }}>
              Sign out
            </button>
          </form>
        </div>
        <p className="sub">What do you want to learn today?</p>

        <div className="kid-subjects">
          <Link href={`/learn/${student.id}`} className="kid-subject math">
            <div className="kid-subject-top">
              <span className="kid-subject-emoji" aria-hidden="true">➗</span>
              <ProgressRing pct={mathPct} />
            </div>
            <span className="kid-subject-name">Math</span>
            <span className="kid-subject-progress">{mathLabel}</span>
            <span className="kid-subject-go">Keep climbing →</span>
          </Link>

          <Link href={`/reading/${student.id}`} className="kid-subject reading">
            <div className="kid-subject-top">
              <span className="kid-subject-emoji" aria-hidden="true">📖</span>
              <ProgressRing pct={readPct} />
            </div>
            <span className="kid-subject-name">Reading</span>
            <span className="kid-subject-progress">{readLabel}</span>
            <span className="kid-subject-go">Keep reading →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
