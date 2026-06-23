import type { SupabaseClient } from "@supabase/supabase-js";

export type Subject = "math" | "reading";

// Free taster: a capped subject gets this many completed lessons per day, then
// the parent is prompted to upgrade.
export const FREE_DAILY_BLOCKS = 1;

export interface ParentBilling {
  subscription_status: string | null;
  subscription_plan: string | null; // free | one | all
  subscription_subject: string | null; // math | reading (for the One plan)
}

export async function getParentBilling(
  admin: SupabaseClient,
  parentId: string,
): Promise<ParentBilling> {
  const { data } = await admin
    .from("parents")
    .select("subscription_status, subscription_plan, subscription_subject")
    .eq("id", parentId)
    .maybeSingle();
  return {
    subscription_status: data?.subscription_status ?? null,
    subscription_plan: data?.subscription_plan ?? "free",
    subscription_subject: data?.subscription_subject ?? null,
  };
}

export function isActive(b: ParentBilling): boolean {
  return b.subscription_status === "active" || b.subscription_status === "trialing";
}

/** Does this parent have FULL (uncapped) access to a subject? */
export function hasFullAccess(b: ParentBilling, subject: Subject): boolean {
  if (!isActive(b)) return false;
  if (b.subscription_plan === "all") return true;
  if (b.subscription_plan === "one") return (b.subscription_subject ?? "math") === subject;
  return false;
}

export interface GateResult {
  locked: boolean;
  plan?: string | null;
}

/**
 * Gate the free taster: full-access subjects are never locked; otherwise the
 * child may finish an in-progress lesson, and may start up to FREE_DAILY_BLOCKS
 * new lessons per day before being asked to upgrade.
 */
export async function checkSubjectGate(
  admin: SupabaseClient,
  student: { id: string; parent_id: string },
  subject: Subject,
): Promise<GateResult> {
  const billing = await getParentBilling(admin, student.parent_id);
  if (hasFullAccess(billing, subject)) return { locked: false };

  const table = subject === "math" ? "path_blocks" : "reading_blocks";
  // Let them finish a lesson already in progress.
  const { data: open } = await admin
    .from(table)
    .select("id")
    .eq("student_id", student.id)
    .is("passed", null)
    .limit(1);
  if (open && open.length > 0) return { locked: false };

  const startToday = new Date();
  startToday.setUTCHours(0, 0, 0, 0);
  const { count } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("student_id", student.id)
    .gte("completed_at", startToday.toISOString());
  if ((count ?? 0) >= FREE_DAILY_BLOCKS) return { locked: true, plan: billing.subscription_plan };
  return { locked: false };
}
