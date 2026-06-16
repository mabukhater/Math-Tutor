import type { SupabaseClient } from "@supabase/supabase-js";
import { pickQuestion } from "./placementServer";
import { computeStreak } from "./practice";

const NEW_SKILLS_CAP = 3;

export interface DailySession {
  id: string;
  session_date: string;
  question_ids: string[];
  num_completed: number;
  num_correct: number;
  completed_at: string | null;
}

interface StudentRow {
  id: string;
  curriculum_id: string;
  current_skill_index: number | null;
  questions_per_day: number;
}

const todayUtc = (now: Date) => now.toISOString().slice(0, 10);

/**
 * Get or build today's daily set (Section 6):
 *  1. review: skills due now (most overdue first), up to ~7 slots
 *  2. fill remaining slots with the next NEW skills (cap 3/day), seeding their
 *     progress rows and advancing current_skill_index
 *  3. one vetted question per chosen skill
 * Idempotent per (student, date) via the daily_sessions unique constraint.
 */
export async function getOrCreateDailySet(
  admin: SupabaseClient,
  student: StudentRow,
  now: Date,
): Promise<DailySession> {
  const date = todayUtc(now);

  const { data: existing } = await admin
    .from("daily_sessions")
    .select("id, session_date, question_ids, num_completed, num_correct, completed_at")
    .eq("student_id", student.id)
    .eq("session_date", date)
    .maybeSingle();
  if (existing) return existing as DailySession;

  const qpd = student.questions_per_day || 10;
  const nowIso = now.toISOString();

  // 1. Review items due now.
  const { data: dueRows } = await admin
    .from("student_skill_progress")
    .select("skill_id, next_due_at")
    .eq("student_id", student.id)
    .lte("next_due_at", nowIso)
    .order("next_due_at", { ascending: true })
    .limit(7);
  const reviewSkillIds: string[] = (dueRows ?? []).map((r) => r.skill_id as string);

  // 2. New skills to introduce.
  const remaining = Math.max(0, qpd - reviewSkillIds.length);
  const newCap = Math.min(NEW_SKILLS_CAP, remaining);
  const newSkills: { id: string; seq: number }[] = [];
  if (newCap > 0) {
    const { data: progRows } = await admin
      .from("student_skill_progress")
      .select("skill_id")
      .eq("student_id", student.id);
    const haveProgress = new Set((progRows ?? []).map((r) => r.skill_id as string));
    const { data: ladder } = await admin
      .from("skills")
      .select("id, sequence_position")
      .eq("curriculum_id", student.curriculum_id)
      .gte("sequence_position", student.current_skill_index ?? 0)
      .order("sequence_position", { ascending: true });
    for (const s of ladder ?? []) {
      if (newSkills.length >= newCap) break;
      if (!haveProgress.has(s.id as string)) {
        newSkills.push({ id: s.id as string, seq: s.sequence_position as number });
      }
    }
  }

  // 3. One vetted question per selected skill.
  const selectedSkillIds = [...reviewSkillIds, ...newSkills.map((s) => s.id)];
  const questionIds: string[] = [];
  for (const skillId of selectedSkillIds) {
    const q = await pickQuestion(admin, skillId, questionIds);
    if (q) questionIds.push(q.id);
  }

  // Seed new-skill progress rows + advance the cursor.
  if (newSkills.length) {
    await admin.from("student_skill_progress").upsert(
      newSkills.map((s) => ({
        student_id: student.id,
        skill_id: s.id,
        box: 0,
        next_due_at: nowIso,
      })),
      { onConflict: "student_id,skill_id", ignoreDuplicates: true },
    );
    const maxNew = Math.max(...newSkills.map((s) => s.seq));
    await admin.from("students").update({ current_skill_index: maxNew + 1 }).eq("id", student.id);
  }

  const { data: session, error } = await admin
    .from("daily_sessions")
    .insert({
      student_id: student.id,
      session_date: date,
      question_ids: questionIds,
      sent_at: nowIso,
      num_completed: 0,
      num_correct: 0,
    })
    .select("id, session_date, question_ids, num_completed, num_correct, completed_at")
    .single();
  if (error) throw new Error(error.message);
  return session as DailySession;
}

/** Consecutive-day streak from completed daily sessions. */
export async function streakForStudent(
  admin: SupabaseClient,
  studentId: string,
  now: Date,
): Promise<number> {
  const { data } = await admin
    .from("daily_sessions")
    .select("session_date")
    .eq("student_id", studentId)
    .not("completed_at", "is", null);
  const dates = (data ?? []).map((r) => r.session_date as string);
  return computeStreak(dates, todayUtc(now));
}
