import type { SupabaseClient } from "@supabase/supabase-js";

export interface Lesson {
  title: string;
  body: string;
}

/** Published topic-level lesson for a (curriculum, topic, grade), or null. */
export async function getLesson(
  admin: SupabaseClient,
  curriculumId: string,
  topicId: string,
  grade: number,
): Promise<Lesson | null> {
  const { data } = await admin
    .from("lessons")
    .select("title, body")
    .eq("curriculum_id", curriculumId)
    .eq("topic_id", topicId)
    .eq("grade", grade)
    .eq("status", "published")
    .is("skill_id", null)
    .maybeSingle();
  return data ? { title: data.title as string, body: data.body as string } : null;
}

/**
 * The lesson to show before a path week: the per-skill weekly lesson if one
 * exists, otherwise the topic's month-intro lesson. Null if neither.
 */
export async function getWeekLesson(
  admin: SupabaseClient,
  skill: { id: string; curriculum_id: string; topic_id: string | null; grade: number },
): Promise<Lesson | null> {
  const { data: skillLesson } = await admin
    .from("lessons")
    .select("title, body")
    .eq("skill_id", skill.id)
    .eq("status", "published")
    .maybeSingle();
  if (skillLesson) {
    return { title: skillLesson.title as string, body: skillLesson.body as string };
  }
  if (!skill.topic_id) return null;
  return getLesson(admin, skill.curriculum_id, skill.topic_id, skill.grade);
}
