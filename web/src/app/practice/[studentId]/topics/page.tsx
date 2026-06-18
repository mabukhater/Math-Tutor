import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTopicsForStudent } from "@/lib/topicsServer";
import { gradeLabel } from "@/lib/curriculum";
import { TopicIcon } from "@/components/TopicIcon";

export const dynamic = "force-dynamic";

function Ring({ pct }: { pct: number }) {
  const r = 13;
  const c = 2 * Math.PI * r;
  const done = c * (pct / 100);
  const color = pct >= 80 ? "var(--green)" : pct > 0 ? "var(--amber)" : "#cbd5e1";
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="17" cy="17" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
      {pct > 0 && (
        <circle
          cx="17"
          cy="17"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${done} ${c}`}
          transform="rotate(-90 17 17)"
        />
      )}
    </svg>
  );
}

export default async function TopicsPage({
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

  const { data: student } = await supabase
    .from("students")
    .select("id, curriculum_id, nominal_grade, display_name")
    .eq("id", studentId)
    .single();
  if (!student) notFound();

  const admin = createAdminClient();
  const topics = await getTopicsForStudent(admin, student);
  const { data: cur } = await admin
    .from("curricula")
    .select("code, name, grade_noun, grade_offset")
    .eq("id", student.curriculum_id)
    .single();
  const label = gradeLabel(cur?.grade_noun, cur?.grade_offset, student.nominal_grade, cur?.code);

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="row" style={{ marginBottom: "0.25rem" }}>
          <h1 style={{ margin: 0 }}>Practice by topic</h1>
          <Link href="/dashboard" className="muted">
            Dashboard
          </Link>
        </div>
        <p className="sub">
          {student.display_name ? `${student.display_name} · ` : ""}
          {label} · {cur?.name}. Extra practice — it builds mastery but won’t affect daily streaks.
        </p>

        {topics.length === 0 ? (
          <p className="muted" style={{ marginTop: "1rem" }}>
            No topics with practice questions at this level yet. Check back soon.
          </p>
        ) : (
          <div className="topic-grid">
            {topics.map((t) => {
              const pct = t.total ? Math.round((t.mastered / t.total) * 100) : 0;
              const status =
                t.attempted === 0 ? "new" : pct >= 80 ? "strong" : "in progress";
              return (
                <Link
                  key={t.code}
                  href={`/practice/${studentId}/topic/${t.code}`}
                  className="topic-card"
                >
                  <div className="topic-icon">
                    <TopicIcon name={t.icon} />
                  </div>
                  <div className="topic-name">{t.name}</div>
                  {t.hasLesson && <span className="topic-learn">Learn + practice</span>}
                  <div className="topic-foot">
                    <Ring pct={pct} />
                    <span className="topic-status">
                      {t.attempted === 0 ? "Start" : `${pct}% · ${status}`}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
