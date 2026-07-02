import type { SupabaseClient } from "@supabase/supabase-js";

export type Subject = "math" | "reading" | "ai";

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
 * AI subject gate — always unlocked while pricing is undecided (OQ-6).
 *
 * TODO(billing): replace with checkSubjectGate(admin, student, "ai", passageId)
 * once the AI pricing tier is decided (one plan? bundled in all? new tier?).
 * checkSubjectGate now handles the "ai" subject correctly (counts only ai7/ai8
 * passages, not reading), so the call-site swap in the block route is one line.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function checkAiGate(): GateResult {
  return { locked: false };
}

/**
 * Gate the free taster: full-access subjects are never locked; otherwise the
 * child may resume the specific lesson they have open, and may START up to
 * FREE_DAILY_BLOCKS new lessons per day before being asked to upgrade.
 *
 * `itemId` is the thing being started/resumed — the skill_id for math, the
 * passage_id for reading/ai. Pass it so "let them finish" only re-opens THAT
 * lesson; without it, a single abandoned open block would keep the gate open
 * forever and defeat the daily cap.
 *
 * The daily cap counts blocks CREATED today (not completed): starting a lesson
 * consumes the allowance, so a child can't dodge it by abandoning lessons and
 * starting new ones. Reading and AI share the reading_blocks table but are kept
 * separate here via passages.subject, so AI activity is not metered against the
 * reading cap (and vice-versa).
 */
export async function checkSubjectGate(
  admin: SupabaseClient,
  student: { id: string; parent_id: string },
  subject: Subject,
  itemId?: string,
): Promise<GateResult> {
  const billing = await getParentBilling(admin, student.parent_id);
  if (hasFullAccess(billing, subject)) return { locked: false };

  const startToday = new Date();
  startToday.setUTCHours(0, 0, 0, 0);
  const sinceToday = startToday.toISOString();

  if (subject === "math") {
    // path_blocks are keyed by skill_id.
    if (itemId) {
      const { data: open } = await admin
        .from("path_blocks")
        .select("id")
        .eq("student_id", student.id)
        .eq("skill_id", itemId)
        .is("passed", null)
        .limit(1);
      if (open && open.length > 0) return { locked: false }; // resume this lesson
    }
    const { count } = await admin
      .from("path_blocks")
      .select("id", { count: "exact", head: true })
      .eq("student_id", student.id)
      .gte("created_at", sinceToday);
    if ((count ?? 0) >= FREE_DAILY_BLOCKS)
      return { locked: true, plan: billing.subscription_plan };
    return { locked: false };
  }

  // reading and ai both live in reading_blocks; tell them apart by passage subject.
  const subjects = subject === "ai" ? ["ai7", "ai8"] : ["reading"];
  if (itemId) {
    const { data: open } = await admin
      .from("reading_blocks")
      .select("id")
      .eq("student_id", student.id)
      .eq("passage_id", itemId)
      .is("passed", null)
      .limit(1);
    if (open && open.length > 0) return { locked: false }; // resume this lesson
  }
  const { count } = await admin
    .from("reading_blocks")
    .select("id, passages!inner(subject)", { count: "exact", head: true })
    .eq("student_id", student.id)
    .in("passages.subject", subjects)
    .gte("created_at", sinceToday);
  if ((count ?? 0) >= FREE_DAILY_BLOCKS)
    return { locked: true, plan: billing.subscription_plan };
  return { locked: false };
}
