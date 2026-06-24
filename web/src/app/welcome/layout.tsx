import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureParent } from "@/lib/parents";

export const dynamic = "force-dynamic";

// Onboarding runs before the parent ever reaches a (parent) page, so the parents
// row may not exist yet. Create it here so profile updates and the first child
// insert (FK students.parent_id -> parents.id) succeed.
export default async function WelcomeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await ensureParent(supabase, user);
  return <>{children}</>;
}
