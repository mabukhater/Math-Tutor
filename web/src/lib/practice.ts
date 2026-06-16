/**
 * Spaced-repetition engine (Section 6 of the brief) — pure, surface-agnostic.
 *
 * Every practice surface (web, Telegram bot, future native app) updates the
 * SAME `student_skill_progress` rows through this logic, so a child's mastery
 * state is one shared thing regardless of where they answer. Pure functions,
 * no I/O — unit-tested in practice.test.ts.
 */

export const MASTERED_BOX = 5;

/** Box -> review interval in days. Box 0 = due today; 5 = mastered (~monthly). */
export function intervalDays(box: number): number {
  switch (box) {
    case 0:
      return 0;
    case 1:
      return 1;
    case 2:
      return 3;
    case 3:
      return 7;
    case 4:
      return 16;
    default:
      return 30; // box 5 — mastered, resurfaces ~monthly to confirm retention
  }
}

export interface ProgressState {
  box: number;
  correct_streak: number;
  total_attempts: number;
  total_correct: number;
}

export interface ProgressUpdate extends ProgressState {
  last_seen_at: string;
  next_due_at: string;
}

const addDaysIso = (now: Date, days: number): string => {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
};

/**
 * Apply one answer to a skill's progress.
 *  correct: box up (max 5), streak++, due in interval(newBox)
 *  wrong:   box down (min 0), streak reset, due tomorrow
 */
export function applyAnswer(
  state: ProgressState,
  correct: boolean,
  now: Date,
): ProgressUpdate {
  let box = state.box;
  let correct_streak = state.correct_streak;
  if (correct) {
    box = Math.min(box + 1, MASTERED_BOX);
    correct_streak = correct_streak + 1;
  } else {
    box = Math.max(box - 1, 0);
    correct_streak = 0;
  }
  const nowIso = now.toISOString();
  const next_due_at = correct ? addDaysIso(now, intervalDays(box)) : addDaysIso(now, 1);
  return {
    box,
    correct_streak,
    total_attempts: state.total_attempts + 1,
    total_correct: state.total_correct + (correct ? 1 : 0),
    last_seen_at: nowIso,
    next_due_at,
  };
}

/**
 * Streak = count of consecutive calendar days (ending today or yesterday) with
 * a completed daily session. `completedDates` are ISO date strings (YYYY-MM-DD).
 */
export function computeStreak(completedDates: string[], today: string): number {
  const set = new Set(completedDates);
  // If today isn't done yet, the streak can still stand on yesterday.
  let cursor = new Date(today + "T00:00:00Z");
  if (!set.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
