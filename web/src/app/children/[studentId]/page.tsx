import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeStreak } from "@/lib/practice";
import { gradeLabel } from "@/lib/curriculum";
import { Flame } from "@/components/icons";

export const dynamic = "force-dynamic";

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function boxTitle(name: string, box: number) {
  const state = box >= 5 ? "mastered" : box === 0 ? "new" : `level ${box}/5`;
  return `${name} · ${state}`;
}

export default async function ChildDashboard({
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
    .select(
      "id, display_name, nominal_grade, curriculum_id, current_skill_index, placement_completed, curricula(name, grade_noun, grade_offset)",
    )
    .eq("id", studentId)
    .single();
  if (!student) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cur = student.curricula as any;
  const levelLabel = gradeLabel(cur?.grade_noun, cur?.grade_offset, student.nominal_grade);

  const initial = student.display_name.charAt(0).toUpperCase();

  if (!student.placement_completed) {
    return (
      <div className="wrap">
        <div className="card">
          <p style={{ marginBottom: "0.5rem" }}>
            <Link href="/dashboard" className="muted">
              ← Back
            </Link>
          </p>
          <h1>{student.display_name}</h1>
          <p className="sub">Run the placement check to unlock the progress map.</p>
          <Link href={`/placement/${student.id}`} className="btn">
            Run placement
          </Link>
        </div>
      </div>
    );
  }

  const { data: curSkill } = await supabase
    .from("skills")
    .select("name, grade")
    .eq("curriculum_id", student.curriculum_id)
    .eq("sequence_position", student.current_skill_index ?? 0)
    .maybeSingle();

  const { data: progress } = await supabase
    .from("student_skill_progress")
    .select("box, total_attempts, total_correct, skills(code, name, domain, sequence_position)")
    .eq("student_id", studentId);

  const { data: sessions } = await supabase
    .from("daily_sessions")
    .select("session_date, num_completed, num_correct, question_ids, completed_at")
    .eq("student_id", studentId)
    .order("session_date", { ascending: false })
    .limit(30);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prog: any[] = progress ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sess: any[] = sessions ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const streak = computeStreak(
    sess.filter((s) => s.completed_at).map((s) => s.session_date),
    today,
  );

  const totalAttempts = prog.reduce((a, p) => a + p.total_attempts, 0);
  const totalCorrect = prog.reduce((a, p) => a + p.total_correct, 0);
  const accuracy = totalAttempts ? Math.round((100 * totalCorrect) / totalAttempts) : 0;
  const mastered = prog.filter((p) => p.box >= 5).length;

  // Last 7 days.
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const s = sess.find((x) => x.session_date === ds);
    const answered = s?.num_completed ?? 0;
    const acc = answered ? (s.num_correct ?? 0) / answered : null;
    let cls = "";
    if (acc !== null) cls = acc >= 0.8 ? "hi" : acc >= 0.5 ? "mid" : "lo";
    days.push({
      label: WEEKDAY[d.getUTCDay()],
      score: answered ? `${s.num_correct}/${answered}` : "—",
      cls,
    });
  }

  // Mastery map grouped by domain, ordered by ladder position.
  const byDomain: Record<string, typeof prog> = {};
  for (const p of prog) {
    const dom = p.skills?.domain ?? "Other";
    (byDomain[dom] ||= []).push(p);
  }
  for (const k in byDomain) byDomain[k].sort((a, b) => a.skills.sequence_position - b.skills.sequence_position);
  const domains = Object.keys(byDomain).sort(
    (a, b) =>
      Math.min(...byDomain[a].map((p) => p.skills.sequence_position)) -
      Math.min(...byDomain[b].map((p) => p.skills.sequence_position)),
  );

  return (
    <div className="wrap" style={{ maxWidth: 620 }}>
      <div className="card">
        <p style={{ marginBottom: "0.75rem" }}>
          <Link href="/dashboard" className="muted">
            ← Back
          </Link>
        </p>
        <div className="detail-head">
          <div className="avatar">{initial}</div>
          <div>
            <h1 style={{ margin: 0 }}>{student.display_name}</h1>
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              {levelLabel}
              {cur?.name ? ` · ${cur.name}` : ""}
              {curSkill ? ` · working on “${curSkill.name}”` : ""}
            </p>
          </div>
        </div>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="v amber">
              <Flame size={20} /> {streak}
            </div>
            <div className="k">day streak</div>
          </div>
          <div className="stat-card">
            <div className="v">{accuracy}%</div>
            <div className="k">accuracy</div>
          </div>
          <div className="stat-card">
            <div className="v">{mastered}</div>
            <div className="k">skills mastered</div>
          </div>
        </div>

        <div className="section-title">Last 7 days</div>
        <div className="week-row">
          {days.map((d, i) => (
            <div key={i} className={"day-cell " + d.cls}>
              <div className="d">{d.label}</div>
              <div className="s">{d.score}</div>
            </div>
          ))}
        </div>

        <div className="section-title">Mastery map</div>
        {prog.length === 0 ? (
          <p className="muted">No practice yet — start a daily set to fill this in.</p>
        ) : (
          <>
            {domains.map((dom) => (
              <div className="mastery-domain" key={dom}>
                <div className="dname">{dom}</div>
                <div className="mastery-cells">
                  {byDomain[dom].map((p) => (
                    <span
                      key={p.skills.code}
                      className={"skill-cell b" + Math.min(p.box, 5)}
                      title={boxTitle(p.skills.name, p.box)}
                    >
                      {p.skills.code.replace("CCSS.", "")}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <div className="legend">
              <span>New</span>
              <span className="sw b0" />
              <span className="sw b1" />
              <span className="sw b2" />
              <span className="sw b3" />
              <span className="sw b4" />
              <span className="sw b5" />
              <span>Mastered</span>
            </div>
          </>
        )}

        <Link href={`/practice/${student.id}`} className="btn" style={{ marginTop: "1.5rem" }}>
          Practice now
        </Link>
      </div>
    </div>
  );
}
