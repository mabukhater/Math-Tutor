import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentKidStudentId } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function KidHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/kids");

  const admin = createAdminClient();
  const studentId = await currentKidStudentId(supabase, admin);
  if (!studentId) redirect("/dashboard"); // a parent landed here

  const { data: student } = await admin
    .from("students")
    .select("id, display_name, placement_completed")
    .eq("id", studentId)
    .single();
  if (!student) redirect("/kids");

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="row" style={{ marginBottom: "0.5rem" }}>
          <h1 style={{ margin: 0 }}>Hi {student.display_name || "there"}! 👋</h1>
          <form action="/auth/signout" method="post">
            <button className="muted" style={{ background: "none", border: "none", cursor: "pointer" }}>
              Sign out
            </button>
          </form>
        </div>
        <p className="sub">What do you want to learn today?</p>

        <div className="kid-subjects">
          <Link href={`/learn/${student.id}`} className="kid-subject math">
            <span className="kid-subject-emoji" aria-hidden="true">➗</span>
            <span className="kid-subject-name">Math</span>
            <span className="kid-subject-go">Start →</span>
          </Link>
          <Link href={`/reading/${student.id}`} className="kid-subject reading">
            <span className="kid-subject-emoji" aria-hidden="true">📖</span>
            <span className="kid-subject-name">Reading</span>
            <span className="kid-subject-go">Start →</span>
          </Link>
        </div>

        {!student.placement_completed && (
          <p className="muted" style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
            Tip: ask your parent to set up your math level first.
          </p>
        )}
      </div>
    </div>
  );
}
