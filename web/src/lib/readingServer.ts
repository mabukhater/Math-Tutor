import type { SupabaseClient } from "@supabase/supabase-js";

export interface ReadingStudent {
  id: string;
  nominal_grade: number;
  pass_threshold: number;
  display_name?: string;
}

export type PassageStatus = "passed" | "active" | "locked";

export interface PassageItem {
  passageId: string;
  title: string;
  status: PassageStatus;
  accuracy: number | null;
}

export interface ReadingPath {
  passages: PassageItem[];
  activePassageId: string | null;
  threshold: number;
}

/** The leveled reading path for a student's grade: published passages (that have
 * questions) ordered by difficulty. First not-passed passage is active; the rest
 * are locked. */
export async function getReadingPath(
  admin: SupabaseClient,
  student: ReadingStudent,
): Promise<ReadingPath> {
  const { data: passages } = await admin
    .from("passages")
    .select("id, title, level_order")
    .eq("grade", student.nominal_grade)
    .eq("status", "published")
    .order("level_order", { ascending: true });
  const all = (passages ?? []) as { id: string; title: string; level_order: number }[];
  if (all.length === 0) return { passages: [], activePassageId: null, threshold: student.pass_threshold };

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
  const items: PassageItem[] = [];
  for (const p of all) {
    if (!withQ.has(p.id)) continue;
    const pr = progBy.get(p.id);
    const passed = !!pr?.passed_at;
    let status: PassageStatus;
    if (passed) status = "passed";
    else if (!activeFound) {
      status = "active";
      activeFound = true;
      activePassageId = p.id;
    } else status = "locked";
    const accuracy =
      pr && pr.total_attempts > 0 ? Math.round((100 * pr.total_correct) / pr.total_attempts) : null;
    items.push({ passageId: p.id, title: p.title, status, accuracy });
  }
  return { passages: items, activePassageId, threshold: student.pass_threshold };
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
    .select("id")
    .eq("passage_id", passageId)
    .eq("status", "vetted");
  const pool = shuffle((qs ?? []).map((q) => q.id as string));
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
