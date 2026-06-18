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
  // Topic skills at this grade.
  const { data: skills } = await admin
    .from("skills")
    .select("id, topic_id")
    .eq("curriculum_id", student.curriculum_id)
    .eq("grade", student.nominal_grade)
    .not("topic_id", "is", null);
  const skillRows = (skills ?? []) as { id: string; topic_id: string }[];
  if (skillRows.length === 0) return [];

  const skillIds = skillRows.map((s) => s.id);

  // Which of those skills actually have vetted questions.
  const { data: vetted } = await admin
    .from("questions")
    .select("skill_id")
    .in("skill_id", skillIds)
    .eq("status", "vetted");
  const skillsWithQuestions = new Set((vetted ?? []).map((r) => r.skill_id as string));

  // Student progress over those skills.
  const { data: prog } = await admin
    .from("student_skill_progress")
    .select("skill_id, box, total_attempts")
    .eq("student_id", student.id)
    .in("skill_id", skillIds);
  const progBySkill = new Map(
    (prog ?? []).map((p) => [p.skill_id as string, p as { box: number; total_attempts: number }]),
  );

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
        if (p.box >= 4) mastered++;
        if (p.total_attempts > 0) attempted++;
      }
    }
    cards.push({
      id: t.id as string,
      code: t.code as string,
      name: t.name as string,
      icon: (t.icon as string) ?? null,
      total: topicSkills.length,
      mastered,
      attempted,
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
    .select("id, skill_id")
    .in("skill_id", skillIds)
    .eq("status", "vetted");
  const bySkill = new Map<string, string[]>();
  for (const q of qs ?? []) {
    const sid = q.skill_id as string;
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
