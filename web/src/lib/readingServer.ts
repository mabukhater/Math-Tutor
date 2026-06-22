import type { SupabaseClient } from "@supabase/supabase-js";

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
    .order("week", { ascending: true })
    .order("level_order", { ascending: true });
  const all = (passages ?? []) as { id: string; title: string; week: number; level_order: number }[];
  const base = { weeks: [], activePassageId: null, threshold: student.pass_threshold, passedPassages: 0, totalPassages: 0 };
  if (all.length === 0) return base;

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
    threshold: student.pass_threshold,
    passedPassages,
    totalPassages,
  };
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
  const { data: open } = await admin
    .from("reading_blocks")
    .select("id, passage_id, question_ids, num_completed, num_correct, passed, threshold")
    .eq("student_id", student.id)
    .eq("passage_id", passageId)
    .is("passed", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open && (open.question_ids as string[]).length > (open.num_completed as number)) {
    return open as ReadingBlock;
  }

  const { data: qs } = await admin
    .from("reading_questions")
    .select("id, difficulty")
    .eq("passage_id", passageId)
    .eq("status", "vetted");
  // Shuffle, then serve easiest-first (detail → inference) so the child ramps up.
  const pool = shuffle((qs ?? []) as { id: string; difficulty: number }[])
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
