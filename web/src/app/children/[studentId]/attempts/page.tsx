import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Check, Cross } from "@/components/icons";

export const dynamic = "force-dynamic";

function pct(correct: number, total: number) {
  return total ? Math.round((100 * correct) / total) : 0;
}
function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface Attempt {
  n: number;
  pct: number;
  passed: boolean | null;
  threshold: number;
  date: string;
}
interface Group {
  name: string;
  attempts: Attempt[];
  best: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function embedName(v: any): string {
  const e = Array.isArray(v) ? v[0] : v;
  return e?.name ?? e?.title ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function groupBlocks(blocks: any[], key: string): Group[] {
  const by = new Map<string, Group>();
  for (const b of blocks ?? []) {
    const name = embedName(b[key]) || "Untitled";
    if (!by.has(name)) by.set(name, { name, attempts: [], best: 0 });
    const g = by.get(name)!;
    const total = (b.question_ids as string[]).length;
    const p = pct(b.num_correct, total);
    g.attempts.push({ n: g.attempts.length + 1, pct: p, passed: b.passed, threshold: b.threshold, date: b.created_at });
    if (b.passed !== null && p > g.best) g.best = p;
  }
  return [...by.values()];
}

function Attempts({ groups, unit }: { groups: Group[]; unit: string }) {
  if (groups.length === 0)
    return <p className="muted" style={{ marginTop: "0.5rem" }}>No {unit} attempts yet.</p>;
  return (
    <div className="attempt-list">
      {groups.map((g) => (
        <div key={g.name} className="attempt-group">
          <div className="attempt-group-head">
            <span className="attempt-name">{g.name}</span>
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              {g.attempts.length} {g.attempts.length === 1 ? "try" : "tries"}
              {g.best > 0 ? ` · best ${g.best}%` : ""}
            </span>
          </div>
          <div className="attempt-chips">
            {g.attempts.map((a) => {
              const cls = a.passed === null ? "wip" : a.passed ? "pass" : "fail";
              return (
                <span key={a.n} className={"attempt-chip " + cls} title={`${dateLabel(a.date)} · pass mark ${a.threshold}%`}>
                  <span className="attempt-n">Try {a.n}</span>
                  {a.passed === null ? (
                    <span className="attempt-pct">in progress</span>
                  ) : (
                    <>
                      <span className="attempt-pct">{a.pct}%</span>
                      {a.passed ? <Check size={13} /> : <Cross size={13} />}
                    </>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
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
      .select("skill_id, num_correct, question_ids, passed, threshold, created_at, skills(name)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: true }),
    admin
      .from("reading_blocks")
      .select("passage_id, num_correct, question_ids, passed, threshold, created_at, passages(title)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: true }),
  ]);

  const math = groupBlocks(pb ?? [], "skills");
  const reading = groupBlocks(rb ?? [], "passages");

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

        <h2 style={{ fontSize: "1.1rem", marginTop: "1rem" }}>Math</h2>
        <Attempts groups={math} unit="math" />

        <h2 style={{ fontSize: "1.1rem", marginTop: "1.5rem" }}>Reading</h2>
        <Attempts groups={reading} unit="reading" />
      </div>
    </div>
  );
}
