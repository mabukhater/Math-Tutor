import type { SupabaseClient } from "@supabase/supabase-js";

const STUDENT_COLS =
  "id, parent_id, curriculum_id, nominal_grade, current_skill_index, pass_threshold, questions_per_day, placement_completed, display_name, telegram_chat_id";

export interface StudentRow {
  id: string;
  parent_id: string;
  curriculum_id: string;
  nominal_grade: number;
  current_skill_index: number | null;
  pass_threshold: number;
  questions_per_day: number;
  placement_completed: boolean;
  display_name: string | null;
  telegram_chat_id: number | null;
}

export type AccessRole = "parent" | "kid";
export interface StudentAccess {
  role: AccessRole;
  student: StudentRow;
}

/**
 * Resolve who may use a given student: the PARENT who owns them, or the KID
 * whose login is linked to them. Returns null if the caller is neither.
 * Uses the service-role client for the lookups (a kid session does not satisfy
 * the parent-scoped RLS), so callers must already trust the session.
 */
export async function resolveStudent(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  studentId: string,
): Promise<StudentAccess | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: student } = await admin
    .from("students")
    .select(STUDENT_COLS)
    .eq("id", studentId)
    .single();
  if (!student) return null;
  const s = student as unknown as StudentRow;

  if (s.parent_id === user.id) return { role: "parent", student: s };

  const { data: kl } = await admin
    .from("kid_logins")
    .select("student_id")
    .eq("kid_user_id", user.id)
    .eq("student_id", studentId)
    .maybeSingle();
  if (kl) return { role: "kid", student: s };

  return null;
}

/** The student a kid session is for (null if the caller is not a kid). */
export async function currentKidStudentId(
  supabase: SupabaseClient,
  admin: SupabaseClient,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await admin
    .from("kid_logins")
    .select("student_id")
    .eq("kid_user_id", user.id)
    .maybeSingle();
  return (data?.student_id as string) ?? null;
}
