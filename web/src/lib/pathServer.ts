import type { SupabaseClient } from "@supabase/supabase-js";

export const BLOCK_SIZE = 20;

export interface PathStudent {
  id: string;
  curriculum_id: string;
  nominal_grade: number;
  current_skill_index: number | null;
  pass_threshold: number;
  display_name?: string;
}

export type WeekStatus = "passed" | "active" | "locked";

export interface Week {
  skillId: string;
  name: string;
  status: WeekStatus;
  accuracy: number | null;
}

export interface Month {
  topicCode: string;
  topicName: string;
  icon: string | null;
  weeks: Week[];
}

export interface PathView {
  months: Month[];
  activeSkillId: string | null;
  threshold: number;
}

interface SkillRow {
  id: string;
  name: string;
  sequence_position: number;
  topic_id: string | null;
}

/**
 * Build the linear path for a student at their grade: topics (months) in
 * sequence, each with its skills (weeks). The first not-yet-passed skill is
 * "active"; everything after it is "locked". Skills the child placed past (or
 * passed a block on) are "passed".
 */
export async function getPathForStudent(
  admin: SupabaseClient,
  student: PathStudent,
): Promise<PathView> {
  const { data: skills } = await admin
    .from("skills")
    .select("id, name, sequence_position, topic_id")
    .eq("curriculum_id", student.curriculum_id)
    .eq("grade", student.nominal_grade)
    .order("sequence_position", { ascending: true });
  const all = (skills ?? []) as SkillRow[];
  if (all.length === 0) return { months: [], activeSkillId: null, threshold: student.pass_threshold };

  const ids = all.map((s) => s.id);
  const { data: vetted } = await admin
    .from("questions")
    .select("skill_id")
    .in("skill_id", ids)
    .eq("status", "vetted");
  const withQ = new Set((vetted ?? []).map((r) => r.skill_id as string));
  const pathSkills = all.filter((s) => s.topic_id && withQ.has(s.id));

  const { data: prog } = await admin
    .from("student_skill_progress")
    .select("skill_id, passed_at, total_attempts, total_correct")
    .eq("student_id", student.id)
    .in("skill_id", ids);
  const progBy = new Map(
    (prog ?? []).map((p) => [
      p.skill_id as string,
      p as { passed_at: string | null; total_attempts: number; total_correct: number },
    ]),
  );

  const cursor = student.current_skill_index ?? 0;
  const { data: topics } = await admin.from("topics").select("id, code, name, icon");
  const topicById = new Map((topics ?? []).map((t) => [t.id as string, t]));

  let activeFound = false;
  let activeSkillId: string | null = null;
  const ordered: Month[] = [];
  const monthByTopic = new Map<string, Month>();

  for (const s of pathSkills) {
    const p = progBy.get(s.id);
    const placedOut = s.sequence_position < cursor;
    const passed = !!p?.passed_at || placedOut;
    let status: WeekStatus;
    if (passed) status = "passed";
    else if (!activeFound) {
      status = "active";
      activeFound = true;
      activeSkillId = s.id;
    } else status = "locked";

    const accuracy =
      p && p.total_attempts > 0 ? Math.round((100 * p.total_correct) / p.total_attempts) : null;

    const t = topicById.get(s.topic_id as string);
    const code = (t?.code as string) ?? "topic";
    let month = monthByTopic.get(code);
    if (!month) {
      month = {
        topicCode: code,
        topicName: (t?.name as string) ?? "Topic",
        icon: (t?.icon as string) ?? null,
        weeks: [],
      };
      monthByTopic.set(code, month);
      ordered.push(month);
    }
    month.weeks.push({ skillId: s.id, name: s.name, status, accuracy });
  }

  return { months: ordered, activeSkillId, threshold: student.pass_threshold };
}

export interface Block {
  id: string;
  skill_id: string;
  question_ids: string[];
  num_completed: number;
  num_correct: number;
  passed: boolean | null;
  threshold: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Resume an in-progress block for this skill, or build a fresh block of up to
 * BLOCK_SIZE vetted questions (snapshotting the current threshold). */
export async function getOrCreateBlock(
  admin: SupabaseClient,
  student: PathStudent,
  skillId: string,
): Promise<Block> {
  const { data: open } = await admin
    .from("path_blocks")
    .select("id, skill_id, question_ids, num_completed, num_correct, passed, threshold")
    .eq("student_id", student.id)
    .eq("skill_id", skillId)
    .is("passed", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open && (open.question_ids as string[]).length > (open.num_completed as number)) {
    return open as Block;
  }

  const { data: qs } = await admin
    .from("questions")
    .select("id")
    .eq("skill_id", skillId)
    .eq("status", "vetted");
  const pool = shuffle((qs ?? []).map((q) => q.id as string)).slice(0, BLOCK_SIZE);
  if (pool.length === 0) throw new Error("no_questions");

  const { data: block, error } = await admin
    .from("path_blocks")
    .insert({
      student_id: student.id,
      skill_id: skillId,
      question_ids: pool,
      num_completed: 0,
      num_correct: 0,
      threshold: student.pass_threshold,
    })
    .select("id, skill_id, question_ids, num_completed, num_correct, passed, threshold")
    .single();
  if (error) throw new Error(error.message);
  return block as Block;
}

/** Mark a skill passed and move the placement cursor past it. */
export async function markSkillPassed(
  admin: SupabaseClient,
  student: PathStudent,
  skillId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await admin
    .from("student_skill_progress")
    .upsert(
      { student_id: student.id, skill_id: skillId, passed_at: now },
      { onConflict: "student_id,skill_id" },
    );
  const { data: skill } = await admin
    .from("skills")
    .select("sequence_position")
    .eq("id", skillId)
    .single();
  if (skill && (skill.sequence_position as number) + 1 > (student.current_skill_index ?? 0)) {
    await admin
      .from("students")
      .update({ current_skill_index: (skill.sequence_position as number) + 1 })
      .eq("id", student.id);
  }
}
