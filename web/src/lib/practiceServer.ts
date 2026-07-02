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
 *  1. review: skills due now (most overdue first), up to the daily target
 *  2. fill remaining slots with the next NEW skills (cap 3/day) that have a
 *     vetted question, seeding their progress rows and advancing the cursor
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

  // 1. Review items due now, capped at the daily target (not a fixed 7, so a
  //    parent who sets questions_per_day below 7 isn't served extra).
  const { data: dueRows } = await admin
    .from("student_skill_progress")
    .select("skill_id, next_due_at")
    .eq("student_id", student.id)
    .lte("next_due_at", nowIso)
    .order("next_due_at", { ascending: true })
    .limit(qpd);
  const reviewSkillIds: string[] = (dueRows ?? []).map((r) => r.skill_id as string);

  // 3a. One vetted question per REVIEW skill. A due skill with no vetted
  //     question simply yields nothing this round.
  const questionIds: string[] = [];
  for (const skillId of reviewSkillIds) {
    const q = await pickQuestion(admin, skillId, questionIds);
    if (q) questionIds.push(q.id);
  }

  // 2/3b. New skills to introduce. Only skills that actually have a vetted
  //       question are seeded and counted — otherwise a content gap would seed a
  //       progress row that never yields a question yet permanently occupies a
  //       review slot (silently shrinking every future daily set). We still
  //       advance the cursor past any skipped (unvetted) skill so the path
  //       doesn't stall on the gap.
  const remaining = Math.max(0, qpd - questionIds.length);
  const newCap = Math.min(NEW_SKILLS_CAP, remaining);
  const seededNew: string[] = [];
  let scannedMaxSeq = -1;
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
      if (seededNew.length >= newCap) break;
      if (haveProgress.has(s.id as string)) continue;
      scannedMaxSeq = Math.max(scannedMaxSeq, s.sequence_position as number);
      const q = await pickQuestion(admin, s.id as string, questionIds);
      if (!q) continue; // no vetted question yet — skip, don't seed a dead slot
      questionIds.push(q.id);
      seededNew.push(s.id as string);
    }
  }

  // Seed the introduced skills' progress rows + advance the cursor past every
  // skill we scanned (including skipped content gaps).
  if (seededNew.length) {
    await admin.from("student_skill_progress").upsert(
      seededNew.map((id) => ({
        student_id: student.id,
        skill_id: id,
        box: 0,
        next_due_at: nowIso,
      })),
      { onConflict: "student_id,skill_id", ignoreDuplicates: true },
    );
  }
  if (scannedMaxSeq >= 0) {
    await admin
      .from("students")
      .update({ current_skill_index: scannedMaxSeq + 1 })
      .eq("id", student.id);
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
  if (error) {
    // A concurrent request (two tabs / double-tap) may have inserted today's
    // session first, tripping the unique (student_id, session_date) constraint.
    // Return that row instead of surfacing a 500.
    if ((error as { code?: string }).code === "23505") {
      const { data: raced } = await admin
        .from("daily_sessions")
        .select("id, session_date, question_ids, num_completed, num_correct, completed_at")
        .eq("student_id", student.id)
        .eq("session_date", date)
        .single();
      if (raced) return raced as DailySession;
    }
    throw new Error(error.message);
  }
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
