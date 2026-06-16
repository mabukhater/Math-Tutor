"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Question {
  id: string;
  stem: string;
  options: string[];
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
    const r = await fetch("/api/practice/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, questionId: question.id, selectedIndex: i }),
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
        <span className="badge">Done for today</span>
        <h1 style={{ marginTop: "0.75rem" }}>
          {total > 0 ? `${numCorrect}/${total} correct` : "Nothing due right now"}
        </h1>
        <p className="sub">
          {streak > 0 ? `🔥 ${streak}-day streak. ` : ""}
          {name ? `Great work, ${name}. ` : ""}Come back tomorrow for the next set.
        </p>
        <Link href="/dashboard" className="btn">
          Back to dashboard
        </Link>
      </Shell>
    );

  return (
    <Shell>
      <div className="progress">
        <div style={{ width: `${total ? (numCompleted / total) * 100 : 0}%` }} />
      </div>
      <p className="muted">
        Question {numCompleted + 1} of {total}
        {streak > 0 ? ` · 🔥 ${streak}-day streak` : ""}
      </p>
      <h2 style={{ marginTop: "0.25rem" }}>{question?.stem}</h2>
      {question?.options.map((opt, i) => {
        let cls = "opt";
        if (phase === "feedback" && selected === i) cls += feedback?.correct ? " correct" : " wrong";
        return (
          <button key={i} className={cls} disabled={phase === "feedback"} onClick={() => answer(i)}>
            {opt}
          </button>
        );
      })}
      {phase === "feedback" && feedback && (
        <>
          <p style={{ marginTop: "1rem", fontWeight: 600 }}>
            {feedback.correct ? "✓ Correct" : "✗ Not quite"}
          </p>
          <p className="muted">{feedback.explanation}</p>
          <button className="btn" onClick={next}>
            {feedback.done ? "See results" : "Next question"}
          </button>
        </>
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
