import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/adminAuth";
import { gradeLabel } from "@/lib/curriculum";
import { getPathForStudent } from "@/lib/pathServer";
import { getReadingPath, getAICoursePath } from "@/lib/readingServer";
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

  // Grade levels that actually have vetted content, per curriculum — drives the
  // "Change grade" control. Siblings often share a curriculum, so compute once.
  const curIds = [...new Set(list.map((s) => s.curriculum_id as string))];
  const gradeOptsByCur = new Map<string, { grade: number; label: string }[]>();
  // Reused in the per-child loop below so we don't re-run the heavy
  // skills_with_vetted RPC once per child for the same curriculum.
  const vetByCur = new Map<string, Set<string>>();
  for (const cur of curIds) {
    const sample = list.find((s) => s.curriculum_id === cur);
    const { data: cs } = await admin.from("skills").select("id, grade").eq("curriculum_id", cur);
    const { data: vet } = await admin.rpc("skills_with_vetted", { cur });
    const vetSet = new Set(((vet ?? []) as { skill_id: string }[]).map((r) => r.skill_id));
    vetByCur.set(cur, vetSet);
    const grades = [
      ...new Set(
        ((cs ?? []) as { id: string; grade: number }[])
          .filter((r) => vetSet.has(r.id))
          .map((r) => r.grade),
      ),
    ].sort((a, b) => a - b);
    gradeOptsByCur.set(
      cur,
      grades.map((g) => ({
        grade: g,
        label: gradeLabel(
          curField(sample?.curricula, "grade_noun"),
          curField(sample?.curricula, "grade_offset"),
          g,
          curField(sample?.curricula, "code"),
        ),
      })),
    );
  }

  const summaries = new Map<
    string,
    {
      math: { passed: number; total: number } | null;
      reading: { passed: number; total: number };
      ai7: { passed: number; total: number } | null;
    }
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
      const path = await getPathForStudent(admin, stud, { vetted: vetByCur.get(s.curriculum_id as string) });
      const weeks = path.months.flatMap((m) => m.weeks);
      math = { passed: weeks.filter((w) => w.status === "passed").length, total: weeks.length };
    }
    const rp = await getReadingPath(admin, stud);
    // AI 7/8 is a grade 7–8 course only — skip the query (and the entry) for others.
    let ai7: { passed: number; total: number } | null = null;
    if (s.nominal_grade === 7 || s.nominal_grade === 8) {
      const ai7p = await getAICoursePath(admin, stud, "ai7");
      ai7 = ai7p.totalPassages > 0
        ? { passed: ai7p.passedPassages, total: ai7p.totalPassages }
        : null;
    }
    summaries.set(s.id, {
      math,
      reading: { passed: rp.passedPassages, total: rp.totalPassages },
      ai7,
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
    gradeOptions: gradeOptsByCur.get(s.curriculum_id as string) ?? [],
    placement: s.placement_completed,
    yearPlan: !!s.year_plan_id,
    threshold: s.pass_threshold,
    username: usernameBy.get(s.id) ?? null,
    math: summaries.get(s.id)?.math ?? null,
    reading: summaries.get(s.id)?.reading ?? { passed: 0, total: 0 },
    ai7: summaries.get(s.id)?.ai7 ?? null,
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
