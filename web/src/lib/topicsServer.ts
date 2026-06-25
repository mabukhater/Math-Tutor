import type { SupabaseClient } from "@supabase/supabase-js";

const TOPIC_SET_SIZE = 10;

export interface StudentRow {
  id: string;
  curriculum_id: string;
  nominal_grade: number;
  display_name?: string;
}

export interface TopicCard {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  total: number; // topic skills at this grade that have vetted questions
  mastered: number; // box >= 4
  attempted: number; // any attempts
  hasLesson: boolean; // a published "learn" lesson exists at this grade
  weeks: number[]; // "Week N" path positions this topic covers (sorted)
}

/**
 * Topics available to a student at their grade (only those with vetted
 * questions), each with a simple mastery summary aggregated over the topic's
 * skills. Drives the browse grid for both child and parent.
 */
export async function getTopicsForStudent(
  admin: SupabaseClient,
  student: StudentRow,
): Promise<TopicCard[]> {
  // Topic skills at this grade, in path order (so we can number the weeks).
  const { data: skills } = await admin
    .from("skills")
    .select("id, topic_id, sequence_position")
    .eq("curriculum_id", student.curriculum_id)
    .eq("grade", student.nominal_grade)
    .not("topic_id", "is", null)
    .order("sequence_position", { ascending: true });
  const skillRows = (skills ?? []) as {
    id: string;
    topic_id: string;
    sequence_position: number;
  }[];
  if (skillRows.length === 0) return [];

  const skillIds = skillRows.map((s) => s.id);

  // Which skills have vetted questions. Computed DB-side (distinct, one row per
  // skill) to avoid PostgREST's 1000-row cap, which would drop skills in grades
  // with many skills × many questions.
  const { data: vetted } = await admin.rpc("skills_with_vetted", {
    cur: student.curriculum_id,
  });
  const skillsWithQuestions = new Set(
    ((vetted ?? []) as { skill_id: string }[]).map((r) => r.skill_id),
  );

  // Global "Week N" numbers: a skill's position among the grade's playable
  // skills (those with vetted questions), in sequence order. This matches the
  // numbering on the learning path, so a topic's week tags point at the exact
  // weeks the child climbs there.
  const weekBySkill = new Map<string, number>();
  let weekNum = 0;
  for (const s of skillRows) {
    if (!skillsWithQuestions.has(s.id)) continue;
    weekNum++;
    weekBySkill.set(s.id, weekNum);
  }

  // Student progress over those skills.
  const { data: prog } = await admin
    .from("student_skill_progress")
    .select("skill_id, box, total_attempts, passed_at")
    .eq("student_id", student.id)
    .in("skill_id", skillIds);
  const progBySkill = new Map(
    (prog ?? []).map((p) => [
      p.skill_id as string,
      p as { box: number; total_attempts: number; passed_at: string | null },
    ]),
  );

  // Topics with a published lesson at this grade.
  const { data: lessonRows } = await admin
    .from("lessons")
    .select("topic_id")
    .eq("curriculum_id", student.curriculum_id)
    .eq("grade", student.nominal_grade)
    .eq("status", "published");
  const topicsWithLesson = new Set((lessonRows ?? []).map((r) => r.topic_id as string));

  const { data: topics } = await admin
    .from("topics")
    .select("id, code, name, icon, sort_order")
    .order("sort_order", { ascending: true });

  const cards: TopicCard[] = [];
  for (const t of topics ?? []) {
    const topicSkills = skillRows.filter(
      (s) => s.topic_id === t.id && skillsWithQuestions.has(s.id),
    );
    if (topicSkills.length === 0) continue; // hide empty topics for this grade
    let mastered = 0;
    let attempted = 0;
    for (const s of topicSkills) {
      const p = progBySkill.get(s.id);
      if (p) {
        // Mastered if practised to a high Leitner box OR passed in the weekly path.
        if (p.box >= 4 || p.passed_at) mastered++;
        if (p.total_attempts > 0 || p.passed_at) attempted++;
      }
    }
    const weeks = topicSkills
      .map((s) => weekBySkill.get(s.id))
      .filter((n): n is number => n != null)
      .sort((a, b) => a - b);
    cards.push({
      id: t.id as string,
      code: t.code as string,
      name: t.name as string,
      icon: (t.icon as string) ?? null,
      total: topicSkills.length,
      mastered,
      attempted,
      hasLesson: topicsWithLesson.has(t.id as string),
      weeks,
    });
  }
  return cards;
}

export interface TopicSession {
  id: string;
  topic_id: string;
  question_ids: string[];
  num_completed: number;
  num_correct: number;
  completed_at: string | null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Resume an in-progress topic session or build a fresh ~10-question set from the
 * topic's skills at the child's grade. Prefers less-mastered skills, then spreads
 * questions across skills. Isolated from daily_sessions — never touches streaks.
 */
export async function getOrCreateTopicSession(
  admin: SupabaseClient,
  student: StudentRow,
  topicId: string,
): Promise<TopicSession> {
  // Resume the latest unfinished session for this topic, if any.
  const { data: open } = await admin
    .from("topic_sessions")
    .select("id, topic_id, question_ids, num_completed, num_correct, completed_at")
    .eq("student_id", student.id)
    .eq("topic_id", topicId)
    .is("completed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open && (open.question_ids as string[]).length > (open.num_completed as number)) {
    return open as TopicSession;
  }

  // Topic skills at this grade.
  const { data: skills } = await admin
    .from("skills")
    .select("id")
    .eq("curriculum_id", student.curriculum_id)
    .eq("grade", student.nominal_grade)
    .eq("topic_id", topicId);
  const skillIds = (skills ?? []).map((s) => s.id as string);
  if (skillIds.length === 0) throw new Error("no_skills");

  // Order skills by least-mastered first (box asc; unseen skills count as 0).
  const { data: prog } = await admin
    .from("student_skill_progress")
    .select("skill_id, box")
    .eq("student_id", student.id)
    .in("skill_id", skillIds);
  const box = new Map((prog ?? []).map((p) => [p.skill_id as string, p.box as number]));
  const orderedSkills = [...skillIds].sort((a, b) => (box.get(a) ?? 0) - (box.get(b) ?? 0));

  // Vetted questions grouped by skill.
  const { data: qs } = await admin
    .from("questions")
    .select("id, skill_id, difficulty")
    .in("skill_id", skillIds)
    .eq("status", "vetted");
  const diffById = new Map<string, number>();
  const bySkill = new Map<string, string[]>();
  for (const q of qs ?? []) {
    const sid = q.skill_id as string;
    diffById.set(q.id as string, (q.difficulty as number) ?? 3);
    if (!bySkill.has(sid)) bySkill.set(sid, []);
    bySkill.get(sid)!.push(q.id as string);
  }
  for (const [, ids] of bySkill) {
    const shuffled = shuffle(ids);
    ids.length = 0;
    ids.push(...shuffled);
  }

  // Round-robin across skills (least-mastered first) until we have the set.
  const questionIds: string[] = [];
  let added = true;
  while (questionIds.length < TOPIC_SET_SIZE && added) {
    added = false;
    for (const sid of orderedSkills) {
      const pool = bySkill.get(sid);
      if (pool && pool.length) {
        questionIds.push(pool.shift()!);
        added = true;
        if (questionIds.length >= TOPIC_SET_SIZE) break;
      }
    }
  }
  if (questionIds.length === 0) throw new Error("no_questions");
  // Serve easiest-first within the set.
  questionIds.sort((a, b) => (diffById.get(a) ?? 3) - (diffById.get(b) ?? 3));

  const { data: session, error } = await admin
    .from("topic_sessions")
    .insert({
      student_id: student.id,
      topic_id: topicId,
      question_ids: questionIds,
      num_completed: 0,
      num_correct: 0,
    })
    .select("id, topic_id, question_ids, num_completed, num_correct, completed_at")
    .single();
  if (error) throw new Error(error.message);
  return session as TopicSession;
}
