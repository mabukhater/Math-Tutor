import type { SupabaseClient } from "@supabase/supabase-js";

export interface Lesson {
  title: string;
  body: string;
}

/** Published lesson for a (curriculum, topic, grade), or null if none exists. */
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
    .maybeSingle();
  return data ? { title: data.title as string, body: data.body as string } : null;
}
