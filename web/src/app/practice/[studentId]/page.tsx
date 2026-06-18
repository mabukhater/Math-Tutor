"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Check, Cross, Flame, Trophy } from "@/components/icons";
import { QuestionVisual, type Visual } from "@/components/QuestionVisual";

const LETTERS = ["A", "B", "C", "D"];

interface Question {
  id: string;
  stem: string;
  options: string[];
  visual?: Visual | null;
}
type Phase = "loading" | "question" | "feedback" | "done" | "error";

interface Resp {
  studentName?: string;
  total: number;
  numCompleted: number;
  numCorrect: number;
  completed?: boolean;
  done?: boolean;
  streak: number;
  question?: Question | null;
  next?: Question | null;
  correct?: boolean;
  explanation?: string;
  correctIndex?: number;
  whyWrong?: string | null;
  correctExplanation?: string | null;
  error?: string;
}

export default function Practice() {
  const { studentId } = useParams<{ studentId: string }>();
  const [phase, setPhase] = useState<Phase>("loading");
  const [errMsg, setErrMsg] = useState("");
  const [name, setName] = useState("");
  const [total, setTotal] = useState(0);
  const [numCompleted, setNumCompleted] = useState(0);
  const [numCorrect, setNumCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Resp | null>(null);
  const shownAt = useRef(0);

  // Reset the per-question timer whenever a new question is shown.
  useEffect(() => {
    shownAt.current = Date.now();
  }, [question?.id]);

  const start = useCallback(async () => {
    setPhase("loading");
    const r = await fetch("/api/practice/today", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    const d: Resp = await r.json();
    if (!r.ok) {
      setErrMsg(
        d.error === "placement_required"
          ? "Finish the placement check first, then daily practice unlocks."
          : "Couldn’t load today’s practice. Please try again.",
      );
      return setPhase("error");
    }
    setName(d.studentName ?? "");
    setTotal(d.total);
    setNumCompleted(d.numCompleted);
    setNumCorrect(d.numCorrect);
    setStreak(d.streak);
    if (d.completed || !d.question) return setPhase("done");
    setQuestion(d.question);
    setSelected(null);
    setPhase("question");
  }, [studentId]);

  useEffect(() => {
    start();
  }, [start]);

  async function answer(i: number) {
    if (phase !== "question" || !question) return;
    setSelected(i);
    const responseTimeMs = shownAt.current ? Date.now() - shownAt.current : null;
    const r = await fetch("/api/practice/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, questionId: question.id, selectedIndex: i, responseTimeMs }),
    });
    const d: Resp = await r.json();
    if (!r.ok) {
      setErrMsg("Something went wrong scoring that answer.");
      return setPhase("error");
    }
    setFeedback(d);
    setNumCompleted(d.numCompleted);
    setNumCorrect(d.numCorrect);
    setStreak(d.streak);
    setPhase("feedback");
  }

  function next() {
    if (!feedback) return;
    if (feedback.done || !feedback.next) return setPhase("done");
    setQuestion(feedback.next);
    setSelected(null);
    setFeedback(null);
    setPhase("question");
  }

  if (phase === "loading")
    return (
      <Shell>
        <p className="muted">Loading today’s practice…</p>
      </Shell>
    );

  if (phase === "error")
    return (
      <Shell>
        <h2>Hmm.</h2>
        <p className="sub">{errMsg}</p>
        <Link href="/dashboard" className="btn">
          Back to dashboard
        </Link>
      </Shell>
    );

  if (phase === "done")
    return (
      <Shell>
        <div className="celebrate pop">
          <div style={{ color: "var(--amber)", display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
            <Trophy size={44} />
          </div>
          <div className="stat-big">
            {total > 0 ? `${numCorrect}/${total}` : "All clear"}
          </div>
          <p className="sub" style={{ marginTop: "0.4rem" }}>
            {total > 0 ? "correct today" : "Nothing due right now"}
          </p>
          {streak > 0 && (
            <div className="streak-row">
              <Flame size={16} /> {streak}-day streak
            </div>
          )}
          <p className="sub" style={{ marginTop: "1rem" }}>
            {name ? `Great work, ${name}! ` : ""}Come back tomorrow for the next set.
          </p>
          <Link href="/dashboard" className="btn">
            Back to dashboard
          </Link>
        </div>
      </Shell>
    );

  return (
    <Shell>
      <div className="progress">
        <div style={{ width: `${total ? (numCompleted / total) * 100 : 0}%` }} />
      </div>
      <p className="muted" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <span>
          Question {numCompleted + 1} of {total}
        </span>
        {streak > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", color: "var(--amber)" }}>
            · <Flame size={14} /> {streak}
          </span>
        )}
      </p>
      <h2 style={{ marginTop: "0.25rem" }}>{question?.stem}</h2>
      {question?.visual && <QuestionVisual visual={question.visual} />}
      {question?.options.map((opt, i) => {
        let cls = "opt";
        const fb = phase === "feedback" && feedback;
        const isCorrect = !!fb && i === feedback?.correctIndex;
        const isWrongPick = !!fb && i === selected && i !== feedback?.correctIndex;
        if (isCorrect) cls += " correct";
        else if (isWrongPick) cls += " wrong";
        return (
          <button key={i} className={cls} disabled={phase === "feedback"} onClick={() => answer(i)}>
            <span className="opt-letter">{LETTERS[i]}</span>
            {opt}
            {isCorrect && (
              <span className="opt-mark">
                <Check size={20} />
              </span>
            )}
            {isWrongPick && (
              <span className="opt-mark">
                <Cross size={20} />
              </span>
            )}
          </button>
        );
      })}
      {phase === "feedback" && feedback && (
        <div className="feedback-box">
          <div className={"feedback-line " + (feedback.correct ? "ok" : "no")}>
            {feedback.correct ? <Check size={20} /> : <Cross size={20} />}
            {feedback.correct ? "Correct!" : "Not quite"}
          </div>
          {!feedback.correct && feedback.whyWrong && <p className="why-wrong">{feedback.whyWrong}</p>}
          {!feedback.correct && typeof feedback.correctIndex === "number" && question && (
            <p style={{ marginTop: "0.5rem", fontWeight: 700 }}>
              The answer is {LETTERS[feedback.correctIndex]}: {question.options[feedback.correctIndex]}
            </p>
          )}
          <p className="muted" style={{ marginTop: "0.3rem" }}>
            {feedback.correct ? feedback.explanation : feedback.correctExplanation ?? feedback.explanation}
          </p>
          <button className="btn" onClick={next}>
            {feedback.done ? "See results" : "Next question"}
          </button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap">
      <div className="card">{children}</div>
    </div>
  );
}
