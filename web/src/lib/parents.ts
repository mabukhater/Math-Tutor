import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

/** Create the parents row on first authenticated visit (idempotent). */
export async function ensureParent(supabase: SupabaseClient, user: User) {
  await supabase
    .from("parents")
    .upsert({ id: user.id, email: user.email }, { onConflict: "id", ignoreDuplicates: true });
}
