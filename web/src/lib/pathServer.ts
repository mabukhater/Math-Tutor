import type { SupabaseClient } from "@supabase/supabase-js";
import { composeBlock } from "./blockSelection";

export const BLOCK_SIZE = 20;

export interface PathStudent {
  id: string;
  curriculum_id: string;
  nominal_grade: number;
  current_skill_index: number | null;
  pass_threshold: number;
  display_name?: string | null;
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
  effectiveGrade: number;
}

interface SkillRow {
  id: string;
  name: string;
  sequence_position: number;
  topic_id: string | null;
  grade: number;
}

/**
 * Build the linear path at the student's EFFECTIVE (placed) level — the grade
 * where their next unfinished skill sits, which may be above or below the grade
 * the parent picked (placement can move them). Within that grade, skills they
 * placed past or already passed are "passed", the first unfinished one is
 * "active", and the rest are "locked". As they finish a grade, the effective
 * grade rolls forward automatically.
 */
export async function getPathForStudent(
  admin: SupabaseClient,
  student: PathStudent,
): Promise<PathView> {
  const { data: skills } = await admin
    .from("skills")
    .select("id, name, sequence_position, topic_id, grade")
    .eq("curriculum_id", student.curriculum_id)
    .order("sequence_position", { ascending: true });
  const all = (skills ?? []) as SkillRow[];
  const empty = {
    months: [],
    activeSkillId: null,
    threshold: student.pass_threshold,
    effectiveGrade: student.nominal_grade,
  };
  if (all.length === 0) return empty;

  const ids = all.map((s) => s.id);
  // Set of skills that have at least one vetted question. Computed in the DB
  // (distinct, one row per skill) because selecting the raw question rows hits
  // PostgREST's 1000-row cap and silently drops later grades' weeks.
  const { data: vetted } = await admin.rpc("skills_with_vetted", {
    cur: student.curriculum_id,
  });
  const withQ = new Set(
    ((vetted ?? []) as { skill_id: string }[]).map((r) => r.skill_id),
  );

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
  const playable = all.filter((s) => s.topic_id && withQ.has(s.id));
  const isPassed = (s: SkillRow) =>
    !!progBy.get(s.id)?.passed_at || s.sequence_position < cursor;

  // The effective grade = grade of the first unfinished playable skill (i.e.
  // where they actually are), falling back to the last grade if all done.
  const activeSkill = playable.find((s) => !isPassed(s)) ?? null;
  const effectiveGrade =
    activeSkill?.grade ?? playable[playable.length - 1]?.grade ?? student.nominal_grade;
  const activeSkillId = activeSkill && activeSkill.grade === effectiveGrade ? activeSkill.id : null;

  const { data: topics } = await admin.from("topics").select("id, code, name, icon");
  const topicById = new Map((topics ?? []).map((t) => [t.id as string, t]));

  const ordered: Month[] = [];
  const monthByTopic = new Map<string, Month>();
  for (const s of playable.filter((s) => s.grade === effectiveGrade)) {
    const p = progBy.get(s.id);
    const status: WeekStatus = isPassed(s) ? "passed" : s.id === activeSkillId ? "active" : "locked";
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

  return { months: ordered, activeSkillId, threshold: student.pass_threshold, effectiveGrade };
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

/** Resume an in-progress block for this skill, or build a fresh block of up to
 * BLOCK_SIZE vetted questions (snapshotting the current threshold). */
export async function getOrCreateBlock(
  admin: SupabaseClient,
  student: PathStudent,
  skillId: string,
): Promise<Block> {
  // Current vetted questions for this skill (retired/draft excluded). Used both
  // to heal a resumed block and to build a fresh one.
  const { data: qs } = await admin
    .from("questions")
    .select("id, difficulty")
    .eq("skill_id", skillId)
    .eq("status", "vetted");
  const vetted = (qs ?? []) as { id: string; difficulty: number }[];
  const vettedSet = new Set(vetted.map((q) => q.id));

  const { data: open } = await admin
    .from("path_blocks")
    .select("id, skill_id, question_ids, num_completed, num_correct, passed, threshold")
    .eq("student_id", student.id)
    .eq("skill_id", skillId)
    .is("passed", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open) {
    const ids = open.question_ids as string[];
    const done = open.num_completed as number;
    const remaining = ids.slice(done);
    const validRemaining = remaining.filter((id) => vettedSet.has(id));
    if (remaining.length > 0 && validRemaining.length === remaining.length) {
      return open as Block; // nothing retired ahead — resume as-is
    }
    if (validRemaining.length > 0) {
      // A question ahead was retired (e.g. by a re-grade) — drop it, keep the
      // answered prefix and the still-valid remainder so progress survives.
      const newIds = ids.slice(0, done).concat(validRemaining);
      const { data: upd } = await admin
        .from("path_blocks")
        .update({ question_ids: newIds })
        .eq("id", open.id)
        .select("id, skill_id, question_ids, num_completed, num_correct, passed, threshold")
        .single();
      if (upd) return upd as Block;
    }
    // Nothing valid left to serve — close this block and start fresh.
    await admin
      .from("path_blocks")
      .update({ passed: false, completed_at: new Date().toISOString() })
      .eq("id", open.id);
  }

  // Fresh block. A retry must not be the same quiz: compose at least half new
  // questions relative to the previous (failed) block, filling the rest with the
  // least-recently-seen repeats, then serve easiest-first. See composeBlock.
  const { data: prevBlock } = await admin
    .from("path_blocks")
    .select("question_ids")
    .eq("student_id", student.id)
    .eq("skill_id", skillId)
    .not("passed", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const previousIds = new Set((prevBlock?.question_ids as string[] | undefined) ?? []);

  const { data: seen } = await admin
    .from("attempts")
    .select("question_id, answered_at")
    .eq("student_id", student.id)
    .in("question_id", vetted.length ? vetted.map((q) => q.id) : ["00000000-0000-0000-0000-000000000000"]);
  const lastSeen = new Map<string, number>();
  for (const a of seen ?? []) {
    const t = new Date(a.answered_at as string).getTime();
    const qid = a.question_id as string;
    if (t > (lastSeen.get(qid) ?? 0)) lastSeen.set(qid, t);
  }

  const pool = composeBlock(vetted, previousIds, lastSeen, BLOCK_SIZE);
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
