import type { SupabaseClient } from "@supabase/supabase-js";

/** The only reading-question fields safe to send to the browser. */
export interface PublicReadingQuestion {
  id: string;
  stem: string;
  options: string[];
  difficulty: number | null;
  /** Which paragraph to re-read for a hint (from the locator), if any. */
  hintParagraph: number | null;
}

/**
 * Strip a reading question down to the browser-safe fields — the reading analog
 * of placementServer.toPublic. Route every served reading question through this
 * so correct_index / explanations can never leak, even if a caller's select
 * over-fetches. Accepts extra fields and simply drops them.
 */
export function toPublicReadingQuestion(q: {
  id: string;
  stem: string;
  options: string[];
  difficulty?: number | null;
  locator?: { paragraph?: number | null } | null;
}): PublicReadingQuestion {
  return {
    id: q.id,
    stem: q.stem,
    options: q.options,
    difficulty: q.difficulty ?? null,
    hintParagraph: q.locator?.paragraph ?? null,
  };
}

export interface ReadingStudent {
  id: string;
  nominal_grade: number;
  pass_threshold: number;
  display_name?: string | null;
}

export type PassageStatus = "passed" | "active" | "locked";

export interface PassageItem {
  passageId: string;
  title: string;
  status: PassageStatus;
  accuracy: number | null;
}

export interface ReadingWeek {
  week: number;
  passages: PassageItem[];
  passed: number;
  total: number;
}

export interface ReadingPath {
  weeks: ReadingWeek[];
  activePassageId: string | null;
  threshold: number;
  passedPassages: number;
  totalPassages: number;
}

/** Extended path returned by AI course endpoints — adds unlock metadata. */
export interface AICoursePath extends ReadingPath {
  course: "ai7" | "ai8";
  unlocked: boolean;
  prereqMessage?: string;
}

// ---------------------------------------------------------------------------
// Pure helpers — exported for unit tests; no DB calls.
// ---------------------------------------------------------------------------

/**
 * Given a sorted passage list with pre-resolved "has vetted questions" and
 * "progress" data, compute the ReadingPath. Extracted from buildPathFromPassages
 * so it can be unit-tested without a Supabase client.
 *
 * @param all      - passages sorted by week/level_order, published only
 * @param withQ    - set of passage IDs that have at least one vetted question
 * @param progBy   - map of passage_id → progress row (may be absent if never attempted)
 * @param threshold - student.pass_threshold
 */
export function computeReadingPath(
  all: { id: string; title: string; week: number; level_order: number }[],
  withQ: Set<string>,
  progBy: Map<string, { passed_at: string | null; total_attempts: number; total_correct: number }>,
  threshold: number,
): ReadingPath {
  if (all.length === 0)
    return { weeks: [], activePassageId: null, threshold, passedPassages: 0, totalPassages: 0 };

  let activeFound = false;
  let activePassageId: string | null = null;
  let passedPassages = 0;
  let totalPassages = 0;
  const weekMap = new Map<number, ReadingWeek>();
  const order: number[] = [];

  for (const p of all) {
    if (!withQ.has(p.id)) continue;
    totalPassages++;
    const pr = progBy.get(p.id);
    const passed = !!pr?.passed_at;
    let status: PassageStatus;
    if (passed) {
      status = "passed";
      passedPassages++;
    } else if (!activeFound) {
      status = "active";
      activeFound = true;
      activePassageId = p.id;
    } else status = "locked";
    const accuracy =
      pr && pr.total_attempts > 0 ? Math.round((100 * pr.total_correct) / pr.total_attempts) : null;

    let wk = weekMap.get(p.week);
    if (!wk) {
      wk = { week: p.week, passages: [], passed: 0, total: 0 };
      weekMap.set(p.week, wk);
      order.push(p.week);
    }
    wk.passages.push({ passageId: p.id, title: p.title, status, accuracy });
    wk.total++;
    if (passed) wk.passed++;
  }

  return {
    weeks: order.map((w) => weekMap.get(w)!),
    activePassageId,
    threshold,
    passedPassages,
    totalPassages,
  };
}

/**
 * Pure unlock check for AI 8: given the set of published+vetted ai7 passage IDs
 * and the set of those that the student has passed, returns true iff every
 * required passage is passed.
 *
 * Extracted from isAi8Unlocked for unit testing without a Supabase client.
 */
export function computeAi8Unlocked(requiredIds: string[], passedIds: Set<string>): boolean {
  if (requiredIds.length === 0) return false;
  return requiredIds.every((id) => passedIds.has(id));
}

// ---------------------------------------------------------------------------
// Private core — builds a ReadingPath from an already-fetched list of
// published passages (already ordered by week, level_order). Shared between
// getReadingPath and getAICoursePath so the algorithm lives in one place.
// ---------------------------------------------------------------------------
async function buildPathFromPassages(
  admin: SupabaseClient,
  student: ReadingStudent,
  all: { id: string; title: string; week: number; level_order: number }[],
): Promise<ReadingPath> {
  if (all.length === 0)
    return { weeks: [], activePassageId: null, threshold: student.pass_threshold, passedPassages: 0, totalPassages: 0 };

  const ids = all.map((p) => p.id);

  const { data: vq } = await admin
    .from("reading_questions")
    .select("passage_id")
    .in("passage_id", ids)
    .eq("status", "vetted");
  const withQ = new Set((vq ?? []).map((r) => r.passage_id as string));

  const { data: prog } = await admin
    .from("reading_progress")
    .select("passage_id, passed_at, total_attempts, total_correct")
    .eq("student_id", student.id)
    .in("passage_id", ids);
  const progBy = new Map(
    (prog ?? []).map((p) => [
      p.passage_id as string,
      p as { passed_at: string | null; total_attempts: number; total_correct: number },
    ]),
  );

  return computeReadingPath(all, withQ, progBy, student.pass_threshold);
}

/** The reading ladder for a student's grade: passages grouped into weeks (3-4
 * each) that get harder week over week. Passages unlock in order across the whole
 * sequence — the first not-passed one is active, the rest locked — so finishing a
 * week unlocks the next. */
export async function getReadingPath(
  admin: SupabaseClient,
  student: ReadingStudent,
): Promise<ReadingPath> {
  const { data: passages } = await admin
    .from("passages")
    .select("id, title, week, level_order")
    .eq("grade", student.nominal_grade)
    .eq("status", "published")
    // Only plain reading passages — AI-course passages (subject ai7/ai8) also
    // carry a grade, so without this they'd leak into the reading ladder for
    // grade 7-8 students (getAICoursePath filters by subject; this must too).
    .eq("subject", "reading")
    .order("week", { ascending: true })
    .order("level_order", { ascending: true });
  const all = (passages ?? []) as { id: string; title: string; week: number; level_order: number }[];
  return buildPathFromPassages(admin, student, all);
}

/**
 * The AI course ladder for ai7 or ai8. Filters passages by subject instead of
 * grade. For ai8, first evaluates the AI-7 prerequisite and returns an
 * empty/locked path when AI-7 is not yet complete (AC-3.1, AC-3.2).
 */
export async function getAICoursePath(
  admin: SupabaseClient,
  student: ReadingStudent,
  course: "ai7" | "ai8",
): Promise<AICoursePath> {
  // For ai8, gate on ai7 completion before fetching ai8 passages (OQ-2).
  if (course === "ai8") {
    const unlocked = await isAi8Unlocked(admin, student);
    if (!unlocked) {
      return {
        weeks: [],
        activePassageId: null,
        threshold: student.pass_threshold,
        passedPassages: 0,
        totalPassages: 0,
        course: "ai8",
        unlocked: false,
        prereqMessage: "Complete AI 7: Foundations first.",
      };
    }
  }

  const { data: passages } = await admin
    .from("passages")
    .select("id, title, week, level_order")
    .eq("subject", course)
    .eq("status", "published")
    .order("week", { ascending: true })
    .order("level_order", { ascending: true });
  const all = (passages ?? []) as { id: string; title: string; week: number; level_order: number }[];
  const base = await buildPathFromPassages(admin, student, all);
  return { ...base, course, unlocked: true };
}

/**
 * True iff every published + vetted ai7 passage has a reading_progress.passed_at
 * for this student. Evaluated at request time — no background job, no stored
 * timestamp (OQ-2, AC-3.2). Used to gate the L7 capstone and AI-8 unlock.
 */
export async function isAi7Complete(
  admin: SupabaseClient,
  student: ReadingStudent,
): Promise<boolean> {
  const { data: passages } = await admin
    .from("passages")
    .select("id")
    .eq("subject", "ai7")
    .eq("status", "published");
  const ai7Ids = (passages ?? []).map((p) => p.id as string);
  if (ai7Ids.length === 0) return false; // no content published yet → not complete

  const { data: vq } = await admin
    .from("reading_questions")
    .select("passage_id")
    .in("passage_id", ai7Ids)
    .eq("status", "vetted");
  const vettedIds = new Set((vq ?? []).map((r) => r.passage_id as string));
  const requiredIds = ai7Ids.filter((id) => vettedIds.has(id));
  if (requiredIds.length === 0) return false;

  const { data: prog } = await admin
    .from("reading_progress")
    .select("passage_id, passed_at")
    .eq("student_id", student.id)
    .in("passage_id", requiredIds)
    .not("passed_at", "is", null);
  const passedSet = new Set((prog ?? []).map((p) => p.passage_id as string));
  return computeAi8Unlocked(requiredIds, passedSet);
}

/**
 * True iff AI-7 is complete for this student.
 * Used to gate AI-8 unlock (OQ-2, AC-3.2).
 * Delegates to isAi7Complete so the logic lives in one place.
 */
export async function isAi8Unlocked(
  admin: SupabaseClient,
  student: ReadingStudent,
): Promise<boolean> {
  return isAi7Complete(admin, student);
}

export interface ReadingBlock {
  id: string;
  passage_id: string;
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

/** Resume an in-progress block for this passage, or build one from all its vetted
 * comprehension questions (a reading block = the whole question set). */
export async function getOrCreateReadingBlock(
  admin: SupabaseClient,
  student: ReadingStudent,
  passageId: string,
): Promise<ReadingBlock> {
  const { data: qs } = await admin
    .from("reading_questions")
    .select("id, difficulty")
    .eq("passage_id", passageId)
    .eq("status", "vetted");
  const vetted = (qs ?? []) as { id: string; difficulty: number }[];
  const vettedSet = new Set(vetted.map((q) => q.id));

  const { data: open } = await admin
    .from("reading_blocks")
    .select("id, passage_id, question_ids, num_completed, num_correct, passed, threshold")
    .eq("student_id", student.id)
    .eq("passage_id", passageId)
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
      return open as ReadingBlock; // nothing retired ahead — resume as-is
    }
    if (validRemaining.length > 0) {
      // A question ahead was retired — drop it, keep answered prefix + remainder.
      const newIds = ids.slice(0, done).concat(validRemaining);
      const { data: upd } = await admin
        .from("reading_blocks")
        .update({ question_ids: newIds })
        .eq("id", open.id)
        .select("id, passage_id, question_ids, num_completed, num_correct, passed, threshold")
        .single();
      if (upd) return upd as ReadingBlock;
    }
    await admin
      .from("reading_blocks")
      .update({ passed: false, completed_at: new Date().toISOString() })
      .eq("id", open.id);
  }

  // Shuffle, then serve easiest-first (detail → inference) so the child ramps up.
  const pool = shuffle(vetted)
    .sort((a, b) => (a.difficulty ?? 3) - (b.difficulty ?? 3))
    .map((q) => q.id);
  if (pool.length === 0) throw new Error("no_questions");

  const { data: block, error } = await admin
    .from("reading_blocks")
    .insert({
      student_id: student.id,
      passage_id: passageId,
      question_ids: pool,
      num_completed: 0,
      num_correct: 0,
      threshold: student.pass_threshold,
    })
    .select("id, passage_id, question_ids, num_completed, num_correct, passed, threshold")
    .single();
  if (error) throw new Error(error.message);
  return block as ReadingBlock;
}

export async function markPassagePassed(
  admin: SupabaseClient,
  studentId: string,
  passageId: string,
): Promise<void> {
  await admin
    .from("reading_progress")
    .upsert(
      { student_id: studentId, passage_id: passageId, passed_at: new Date().toISOString() },
      { onConflict: "student_id,passage_id" },
    );
}
