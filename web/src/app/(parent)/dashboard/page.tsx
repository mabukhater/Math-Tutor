import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/adminAuth";
import { gradeLabel } from "@/lib/curriculum";
import { getPathForStudent } from "@/lib/pathServer";
import { getReadingPath } from "@/lib/readingServer";
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
  if (!user) return null; // layout already guards; satisfies types
  const admin = createAdminClient();

  const { data: billing } = await supabase
    .from("parents")
    .select("subscription_plan, subscription_status, full_name")
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

  const summaries = new Map<
    string,
    { math: { passed: number; total: number } | null; reading: { passed: number; total: number } }
  >();
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
    summaries.set(s.id, { math, reading: { passed: rp.passedPassages, total: rp.totalPassages } });
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

  const plan = billing?.subscription_plan ?? "free";
  const planLabel = plan === "all" ? "All Subjects" : plan === "one" ? "One Subject" : "Free plan";

  return (
    <>
      <div className="parent-page-head">
        <h1 style={{ margin: 0 }}>Your children</h1>
        <Link href="/billing" className="plan-chip">
          {planLabel}
          {billing?.subscription_status ? ` · ${billing.subscription_status}` : ""}
        </Link>
      </div>

      {!billing?.full_name && (
        <Link href="/account" className="profile-nudge">
          Finish setting up your profile →
        </Link>
      )}

      <DashboardViews kids={kids} />

      <Link href="/children/new" className="btn" style={{ marginTop: "1.25rem" }}>
        Add a child
      </Link>

      {isAdminEmail(user.email) && (
        <p style={{ marginTop: "1rem" }}>
          <Link href="/vet" className="muted">
            Admin · vet questions →
          </Link>{" "}
          ·{" "}
          <Link href="/early/results" className="muted">
            waitlist results →
          </Link>
        </p>
      )}
    </>
  );
}
