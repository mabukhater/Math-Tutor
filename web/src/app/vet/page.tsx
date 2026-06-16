import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail, adminEmails } from "@/lib/adminAuth";
import VetClient from "./VetClient";

export const dynamic = "force-dynamic";

export default async function VetPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!isAdminEmail(user.email)) {
    const hint =
      adminEmails().length === 0
        ? "Set the ADMIN_EMAILS environment variable (comma-separated) to enable vetting, then restart."
        : `Signed in as ${user.email}, which isn’t on the admin list.`;
    return (
      <div className="wrap">
        <div className="card">
          <h1>Not authorized</h1>
          <p className="sub">Question vetting is admin-only. {hint}</p>
        </div>
      </div>
    );
  }

  return <VetClient />;
}
