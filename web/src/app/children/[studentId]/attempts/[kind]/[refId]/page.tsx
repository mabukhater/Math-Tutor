import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Check, Cross } from "@/components/icons";

export const dynamic = "force-dynamic";
const LETTERS = ["A", "B", "C", "D"];

interface QView {
  stem: string;
  options: string[];
  correctIndex: number;
  selectedIndex: number | null;
  correct: boolean | null;
  tries: number;
}

// Latest attempt per question + how many times it was tried.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function latestByQuestion(attempts: any[], idKey: string) {
  const latest = new Map<string, { selected_index: number; is_correct: boolean }>();
  const tries = new Map<string, number>();
  for (const a of attempts ?? []) {
    const qid = a[idKey] as string;
    if (!qid) continue;
    tries.set(qid, (tries.get(qid) ?? 0) + 1);
    if (!latest.has(qid)) latest.set(qid, a); // attempts come newest-first
  }
  return { latest, tries };
}

function QuestionReview({ v, n }: { v: QView; n: number }) {
  return (
    <div className="rev-q">
      <div className="rev-q-head">
        <span className="rev-q-n">Q{n}</span>
        {v.correct === null ? (
          <span className="rev-tag wip">not answered yet</span>
        ) : v.correct ? (
          <span className="rev-tag ok">
            <Check size={13} /> correct
          </span>
        ) : (
          <span className="rev-tag no">
            <Cross size={13} /> wrong
          </span>
        )}
        {v.tries > 1 && <span className="muted" style={{ fontSize: "0.78rem" }}>· {v.tries} tries</span>}
      </div>
      <div className="rev-stem">{v.stem}</div>
      <div className="rev-opts">
        {v.options.map((o, i) => {
          const isCorrect = i === v.correctIndex;
          const isPick = i === v.selectedIndex;
          let cls = "rev-opt";
          if (isCorrect) cls += " correct";
          else if (isPick) cls += " wrong";
          return (
            <div key={i} className={cls}>
              <span className="opt-letter">{LETTERS[i]}</span>
              <span className="rev-opt-text">{o}</span>
              {isPick && <span className="rev-pick">their pick</span>}
              {isCorrect && <Check size={16} />}
              {isPick && !isCorrect && <Cross size={16} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default async function AttemptDetail({
  params,
}: {
  params: Promise<{ studentId: string; kind: string; refId: string }>;
}) {
  const { studentId, kind, refId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: student } = await supabase
    .from("students")
    .select("id, display_name")
    .eq("id", studentId)
    .single();
  if (!student) notFound();
  const admin = createAdminClient();

  let title = "";
  let subtitle = "";
  let views: QView[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let paragraphs: { n: number; text: string }[] = [];

  if (kind === "math") {
    const { data: skill } = await admin.from("skills").select("name").eq("id", refId).single();
    if (!skill) notFound();
    title = skill.name as string;
    subtitle = "Math";
    const { data: qs } = await admin
      .from("questions")
      .select("id, stem, options, correct_index")
      .eq("skill_id", refId);
    const qById = new Map((qs ?? []).map((q) => [q.id as string, q]));
    const qids = (qs ?? []).map((q) => q.id as string);
    const { data: atts } = await admin
      .from("attempts")
      .select("question_id, selected_index, is_correct, answered_at")
      .eq("student_id", studentId)
      .in("question_id", qids.length ? qids : ["00000000-0000-0000-0000-000000000000"])
      .order("answered_at", { ascending: false });
    const { latest, tries } = latestByQuestion(atts ?? [], "question_id");
    views = [...latest.entries()].map(([qid, a]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = qById.get(qid) as any;
      return {
        stem: q?.stem ?? "",
        options: (q?.options as string[]) ?? [],
        correctIndex: (q?.correct_index as number) ?? -1,
        selectedIndex: a.selected_index,
        correct: a.is_correct,
        tries: tries.get(qid) ?? 1,
      };
    });
  } else if (kind === "reading") {
    const { data: passage } = await admin
      .from("passages")
      .select("title, paragraphs")
      .eq("id", refId)
      .single();
    if (!passage) notFound();
    title = passage.title as string;
    subtitle = "Reading passage";
    paragraphs = (passage.paragraphs as { n: number; text: string }[]) ?? [];
    const { data: rqs } = await admin
      .from("reading_questions")
      .select("id, stem, options, correct_index, difficulty")
      .eq("passage_id", refId)
      .eq("status", "vetted")
      .order("difficulty", { ascending: true });
    const { data: atts } = await admin
      .from("attempts")
      .select("reading_question_id, selected_index, is_correct, answered_at")
      .eq("student_id", studentId)
      .not("reading_question_id", "is", null)
      .order("answered_at", { ascending: false });
    const { latest, tries } = latestByQuestion(atts ?? [], "reading_question_id");
    views = (rqs ?? []).map((q) => {
      const a = latest.get(q.id as string);
      return {
        stem: q.stem as string,
        options: (q.options as string[]) ?? [],
        correctIndex: (q.correct_index as number) ?? -1,
        selectedIndex: a?.selected_index ?? null,
        correct: a ? a.is_correct : null,
        tries: tries.get(q.id as string) ?? 0,
      };
    });
  } else {
    notFound();
  }

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="row" style={{ marginBottom: "0.25rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>{title}</h1>
          <Link href={`/children/${studentId}/attempts`} className="muted home-link">
            ← Attempts
          </Link>
        </div>
        <p className="sub">
          {subtitle} · {student.display_name}’s answers
        </p>

        {kind === "reading" && paragraphs.length > 0 && (
          <div className="rc-passage" style={{ marginBottom: "1rem" }}>
            <div className="rc-passage-title">{title}</div>
            {paragraphs.map((p) => (
              <p key={p.n} className="rc-para">
                <span className="rc-pnum">¶{p.n}</span>
                {p.text}
              </p>
            ))}
          </div>
        )}

        {views.length === 0 ? (
          <p className="muted">
            No answered questions recorded yet
            {kind === "reading" ? " (older reading attempts weren’t saved per-question)" : ""}.
          </p>
        ) : (
          views.map((v, i) => <QuestionReview key={i} v={v} n={i + 1} />)
        )}
      </div>
    </div>
  );
}
