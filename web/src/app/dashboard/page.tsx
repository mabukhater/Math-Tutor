import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureParent } from "@/lib/parents";
import { isAdminEmail } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await ensureParent(supabase, user);

  const { data: students } = await supabase
    .from("students")
    .select("id, display_name, nominal_grade, placement_completed, current_skill_index, telegram_chat_id")
    .order("created_at", { ascending: true });

  return (
    <div className="wrap">
      <div className="card">
        <div className="row" style={{ marginBottom: "1rem" }}>
          <h1 style={{ margin: 0 }}>Your children</h1>
          <form action="/auth/signout" method="post">
            <button className="muted" style={{ background: "none", border: "none", cursor: "pointer" }}>
              Sign out
            </button>
          </form>
        </div>

        {(!students || students.length === 0) && (
          <p className="sub">No children yet. Add one to run the placement check.</p>
        )}

        {students?.map((s) => (
          <div className="list-item" key={s.id}>
            <div className="row">
              <div>
                <strong>{s.display_name}</strong>{" "}
                <span className="muted">Grade {s.nominal_grade}</span>
                <div className="muted" style={{ fontSize: "0.82rem" }}>
                  {s.placement_completed
                    ? s.telegram_chat_id
                      ? "Placed · Telegram linked"
                      : "Placed · not yet on Telegram"
                    : "Placement not done"}
                </div>
              </div>
              {s.placement_completed ? (
                <Link href={`/children/${s.id}/link`} className="badge">
                  {s.telegram_chat_id ? "Linked" : "Link Telegram"}
                </Link>
              ) : (
                <Link href={`/placement/${s.id}`} className="badge">
                  Run placement
                </Link>
              )}
            </div>
          </div>
        ))}

        <Link href="/children/new" className="btn" style={{ marginTop: "1.25rem" }}>
          Add a child
        </Link>

        {isAdminEmail(user.email) && (
          <p style={{ marginTop: "1rem", textAlign: "center" }}>
            <Link href="/vet" className="muted">
              Admin · vet questions →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
