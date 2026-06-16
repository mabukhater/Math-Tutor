import type { SupabaseClient } from "@supabase/supabase-js";
import type { LadderSkill } from "./placement";

export interface LoadedLadder {
  ladder: LadderSkill[];
  /** sequence_position -> skill id */
  idByIndex: Record<number, string>;
  /** sequence_position -> { name, grade } */
  metaByIndex: Record<number, { name: string; grade: number }>;
}

/** Load the ordered skill ladder for a curriculum (admin client). */
export async function loadLadder(
  admin: SupabaseClient,
  curriculumId: string,
): Promise<LoadedLadder> {
  const { data, error } = await admin
    .from("skills")
    .select("id, name, grade, sequence_position")
    .eq("curriculum_id", curriculumId)
    .order("sequence_position", { ascending: true });
  if (error) throw new Error(error.message);

  const ladder: LadderSkill[] = [];
  const idByIndex: Record<number, string> = {};
  const metaByIndex: Record<number, { name: string; grade: number }> = {};
  for (const row of data ?? []) {
    const idx = row.sequence_position as number;
    ladder.push({ index: idx, grade: row.grade as number });
    idByIndex[idx] = row.id as string;
    metaByIndex[idx] = { name: row.name as string, grade: row.grade as number };
  }
  return { ladder, idByIndex, metaByIndex };
}

export interface PublicQuestion {
  id: string;
  stem: string;
  options: string[];
}

interface FullQuestion extends PublicQuestion {
  correct_index: number;
  explanation: string;
  difficulty: number;
}

/**
 * Pick a vetted question for a skill, preferring medium difficulty (3) and
 * avoiding ones already used this session. Returns null if the skill has no
 * eligible vetted question (i.e. it still needs vetting).
 */
export async function pickQuestion(
  admin: SupabaseClient,
  skillId: string,
  excludeIds: string[],
): Promise<FullQuestion | null> {
  const { data, error } = await admin
    .from("questions")
    .select("id, stem, options, correct_index, explanation, difficulty")
    .eq("skill_id", skillId)
    .eq("status", "vetted");
  if (error) throw new Error(error.message);
  const pool = (data ?? []).filter((q) => !excludeIds.includes(q.id as string));
  if (pool.length === 0) return null;
  pool.sort(
    (a, b) => Math.abs((a.difficulty as number) - 3) - Math.abs((b.difficulty as number) - 3),
  );
  const q = pool[0];
  return {
    id: q.id as string,
    stem: q.stem as string,
    options: q.options as string[],
    correct_index: q.correct_index as number,
    explanation: q.explanation as string,
    difficulty: q.difficulty as number,
  };
}

/** Strip the answer before sending a question to the browser. */
export function toPublic(q: { id: string; stem: string; options: string[] }): PublicQuestion {
  return { id: q.id, stem: q.stem, options: q.options };
}
