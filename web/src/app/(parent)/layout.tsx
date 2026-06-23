import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureParent } from "@/lib/parents";
import { currentKidStudentId } from "@/lib/access";
import { SidebarNav } from "@/components/SidebarNav";

export const dynamic = "force-dynamic";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  if (await currentKidStudentId(supabase, admin)) redirect("/me");
  await ensureParent(supabase, user);

  const { data: parent } = await supabase
    .from("parents")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="parent-shell">
      <SidebarNav parentName={parent?.full_name ?? ""} email={user.email ?? ""} />
      <main className="parent-main">{children}</main>
    </div>
  );
}
