import type { SupabaseClient } from "@supabase/supabase-js";

export interface PlanItem {
  subject: "math" | "language";
  kind: "math_skill" | "reading_passage";
  title: string;
  done: boolean;
}

export interface PlanWeek {
  weekNo: number;
  startDate: string;
  title: string;
  items: PlanItem[];
  done: boolean;
}

export interface YearPlan {
  yearLabel: string;
  numWeeks: number;
  expectedWeek: number;
  currentWeek: number;
  weeks: PlanWeek[];
  mathCovered: number;
  mathTotal: number;
}

interface YPStudent {
  id: string;
  year_plan_id: string | null;
}

/** The year plan for an enrolled student: the Sept-June schedule with each
 * item's done state, plus pace (expected vs current week) and Ontario math
 * expectation coverage. Null if the student isn't enrolled in a year plan. */
export async function getYearPlan(
  admin: SupabaseClient,
  student: YPStudent,
): Promise<YearPlan | null> {
  if (!student.year_plan_id) return null;
  const { data: yp } = await admin
    .from("year_plans")
    .select("id, grade, curriculum_id, year_label, start_date, num_weeks")
    .eq("id", student.year_plan_id)
    .single();
  if (!yp) return null;

  const { data: weeks } = await admin
    .from("plan_weeks")
    .select("id, week_no, start_date, title")
    .eq("year_plan_id", yp.id)
    .order("week_no", { ascending: true });
  const weekRows = (weeks ?? []) as { id: string; week_no: number; start_date: string; title: string }[];
  const weekIds = weekRows.map((w) => w.id);

  const { data: items } = await admin
    .from("plan_items")
    .select("plan_week_id, subject, kind, ref_id, title, expectation_codes, sort_order")
    .in("plan_week_id", weekIds.length ? weekIds : ["00000000-0000-0000-0000-000000000000"])
    .order("sort_order", { ascending: true });
  const itemRows = (items ?? []) as {
    plan_week_id: string;
    subject: "math" | "language";
    kind: "math_skill" | "reading_passage";
    ref_id: string;
    title: string;
    expectation_codes: string[];
  }[];

  // Progress: which skills / passages are passed.
  const { data: sp } = await admin
    .from("student_skill_progress")
    .select("skill_id, passed_at")
    .eq("student_id", student.id);
  const passedSkills = new Set((sp ?? []).filter((r) => r.passed_at).map((r) => r.skill_id as string));
  const { data: rp } = await admin
    .from("reading_progress")
    .select("passage_id, passed_at")
    .eq("student_id", student.id);
  const passedPassages = new Set(
    (rp ?? []).filter((r) => r.passed_at).map((r) => r.passage_id as string),
  );

  const itemDone = (kind: string, refId: string) =>
    kind === "math_skill" ? passedSkills.has(refId) : passedPassages.has(refId);

  const byWeek = new Map<string, typeof itemRows>();
  for (const it of itemRows) {
    if (!byWeek.has(it.plan_week_id)) byWeek.set(it.plan_week_id, []);
    byWeek.get(it.plan_week_id)!.push(it);
  }

  let currentWeek = yp.num_weeks + 1;
  const planWeeks: PlanWeek[] = weekRows.map((w) => {
    const its = (byWeek.get(w.id) ?? []).map((it) => ({
      subject: it.subject,
      kind: it.kind,
      title: it.title,
      done: itemDone(it.kind, it.ref_id),
    }));
    const done = its.length > 0 && its.every((i) => i.done);
    if (!done && w.week_no < currentWeek) currentWeek = w.week_no;
    return { weekNo: w.week_no, startDate: w.start_date, title: w.title, items: its, done };
  });

  // Math expectation coverage: an expectation is covered if its math skill is passed.
  const { data: exps } = await admin
    .from("expectations")
    .select("code")
    .eq("curriculum_id", yp.curriculum_id)
    .eq("grade", yp.grade)
    .eq("subject", "math");
  const allExp = new Set((exps ?? []).map((e) => e.code as string));
  const coveredExp = new Set<string>();
  for (const it of itemRows) {
    if (it.kind === "math_skill" && passedSkills.has(it.ref_id)) {
      for (const c of it.expectation_codes ?? []) coveredExp.add(c);
    }
  }

  // Pace: where a steady learner would be by now. During the plan's own school
  // year we measure against the calendar; outside it (e.g. a mid-summer signup)
  // we measure from when the child enrolled, so pace stays meaningful and never
  // shows an absurd "behind" for a brand-new account.
  const DAY = 24 * 3600 * 1000;
  const start = new Date(yp.start_date + "T00:00:00").getTime();
  const end = start + yp.num_weeks * 7 * DAY;
  const now = Date.now();
  let anchor = start;
  if (now > end) {
    const { data: st } = await admin
      .from("students")
      .select("created_at")
      .eq("id", student.id)
      .single();
    if (st?.created_at) anchor = new Date(st.created_at).getTime();
  }
  const weeksElapsed = Math.floor((now - anchor) / (7 * DAY)) + 1;
  const expectedWeek = Math.max(1, Math.min(yp.num_weeks, weeksElapsed));

  return {
    yearLabel: yp.year_label,
    numWeeks: yp.num_weeks,
    expectedWeek,
    currentWeek,
    weeks: planWeeks,
    mathCovered: coveredExp.size,
    mathTotal: allExp.size,
  };
}
