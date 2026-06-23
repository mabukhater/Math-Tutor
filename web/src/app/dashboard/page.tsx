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
import { BillingControl } from "@/components/BillingControl";
import { DashboardViews, type Kid } from "@/components/DashboardViews";

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

  const { data: billing } = await supabase
    .from("parents")
    .select("subscription_plan, subscription_status, subscription_subject")
    .eq("id", user.id)
    .maybeSingle();

  const { data: students } = await supabase
    .from("students")
    .select(
      "id, display_name, nominal_grade, placement_completed, current_skill_index, pass_threshold, curriculum_id, year_plan_id, curricula(code, name, grade_noun, grade_offset)",
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
      reading: { passed: rp.passedPassages, total: rp.totalPassages },
    });
  }

  const kids: Kid[] = list.map((s) => ({
    id: s.id,
    name: s.display_name,
    grade: s.nominal_grade,
    gradeLabel: gradeLabel(
      curField(s.curricula, "grade_noun"),
      curField(s.curricula, "grade_offset"),
      s.nominal_grade,
      curField(s.curricula, "code"),
    ),
    placement: s.placement_completed,
    yearPlan: !!s.year_plan_id,
    threshold: s.pass_threshold,
    username: usernameBy.get(s.id) ?? null,
    math: summaries.get(s.id)?.math ?? null,
    reading: summaries.get(s.id)?.reading ?? { passed: 0, total: 0 },
  }));

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 880 }}>
        <div className="row" style={{ marginBottom: "1rem" }}>
          <h1 style={{ margin: 0 }}>Your children</h1>
          <form action="/auth/signout" method="post">
            <button className="muted" style={{ background: "none", border: "none", cursor: "pointer" }}>
              Sign out
            </button>
          </form>
        </div>

        <BillingControl
          plan={billing?.subscription_plan ?? "free"}
          status={billing?.subscription_status ?? null}
          subject={billing?.subscription_subject ?? null}
        />

        <DashboardViews kids={kids} />

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
