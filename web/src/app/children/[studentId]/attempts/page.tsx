import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AttemptsExplorer, type TryRow } from "@/components/AttemptsExplorer";

export const dynamic = "force-dynamic";

function pct(correct: number, total: number) {
  return total ? Math.round((100 * correct) / total) : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function embedName(v: any): string {
  const e = Array.isArray(v) ? v[0] : v;
  return e?.name ?? e?.title ?? "";
}

// Flatten path/reading blocks into one row per try, numbering the tries per
// lesson in date order (blocks come ordered by created_at ascending).
function flatten(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks: any[],
  embedKey: string,
  idField: string,
  subject: "math" | "reading",
): TryRow[] {
  const counts = new Map<string, number>();
  const rows: TryRow[] = [];
  for (const b of blocks ?? []) {
    const refId = b[idField] as string;
    if (!refId) continue;
    const n = (counts.get(refId) ?? 0) + 1;
    counts.set(refId, n);
    const total = (b.question_ids as string[]).length;
    rows.push({
      subject,
      lessonName: embedName(b[embedKey]) || "Untitled",
      refId,
      n,
      pct: pct(b.num_correct, total),
      passed: b.passed,
      threshold: b.threshold,
      // Date a try by when it was finished, not when the lesson block was first
      // created — a child can start a lesson one day and finish it the next, and
      // it should count (and filter) as the day they actually did the work.
      date: b.completed_at ?? b.created_at,
    });
  }
  return rows;
}

export default async function AttemptsPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Parent-only: RLS lets only the owning parent read the student row.
  const { data: student } = await supabase
    .from("students")
    .select("id, display_name")
    .eq("id", studentId)
    .single();
  if (!student) notFound();

  const admin = createAdminClient();
  const [{ data: pb }, { data: rb }] = await Promise.all([
    admin
      .from("path_blocks")
      .select("skill_id, num_correct, question_ids, passed, threshold, created_at, completed_at, skills(name)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: true }),
    admin
      .from("reading_blocks")
      .select("passage_id, num_correct, question_ids, passed, threshold, created_at, completed_at, passages(title)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: true }),
  ]);

  const rows = [
    ...flatten(pb ?? [], "skills", "skill_id", "math"),
    ...flatten(rb ?? [], "passages", "passage_id", "reading"),
  ];

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="row" style={{ marginBottom: "0.25rem" }}>
          <h1 style={{ margin: 0 }}>{student.display_name}’s attempts</h1>
          <Link href="/dashboard" className="muted home-link">
            Dashboard
          </Link>
        </div>
        <p className="sub">Every try on each lesson, with the score they got.</p>

        {rows.length === 0 ? (
          <p className="muted" style={{ marginTop: "1rem" }}>
            No attempts yet.
          </p>
        ) : (
          <AttemptsExplorer rows={rows} studentId={studentId} />
        )}
      </div>
    </div>
  );
}
