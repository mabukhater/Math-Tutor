"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Cross, Trophy } from "@/components/icons";

const LETTERS = ["A", "B", "C", "D"];

interface Question {
  id: string;
  stem: string;
  options: string[];
}
type Phase = "loading" | "question" | "feedback" | "done" | "error";

interface Resp {
  sessionId?: string;
  topicName?: string;
  studentName?: string;
  total: number;
  numCompleted: number;
  numCorrect: number;
  completed?: boolean;
  done?: boolean;
  question?: Question | null;
  next?: Question | null;
  correct?: boolean;
  explanation?: string;
  correctIndex?: number;
  whyWrong?: string | null;
  correctExplanation?: string | null;
  error?: string;
}

export default function TopicPractice({
  studentId,
  topicCode,
}: {
  studentId: string;
  topicCode: string;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [errMsg, setErrMsg] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [topicName, setTopicName] = useState("");
  const [total, setTotal] = useState(0);
  const [numCompleted, setNumCompleted] = useState(0);
  const [numCorrect, setNumCorrect] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Resp | null>(null);
  const shownAt = useRef(0);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [question?.id]);

  const start = useCallback(async () => {
    setPhase("loading");
    const r = await fetch("/api/practice/topic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, topicCode }),
    });
    const d: Resp = await r.json();
    if (!r.ok) {
      setErrMsg(
        d.error === "no_questions"
          ? "This topic doesn’t have practice questions for this level yet."
          : "Couldn’t load this topic. Please try again.",
      );
      return setPhase("error");
    }
    setSessionId(d.sessionId ?? "");
    setTopicName(d.topicName ?? "");
    setTotal(d.total);
    setNumCompleted(d.numCompleted);
    setNumCorrect(d.numCorrect);
    if (d.completed || !d.question) return setPhase("done");
    setQuestion(d.question);
    setSelected(null);
    setPhase("question");
  }, [studentId, topicCode]);

  useEffect(() => {
    start();
  }, [start]);

  async function answer(i: number) {
    if (phase !== "question" || !question) return;
    setSelected(i);
    const responseTimeMs = shownAt.current ? Date.now() - shownAt.current : null;
    const r = await fetch("/api/practice/topic/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        sessionId,
        questionId: question.id,
        selectedIndex: i,
        responseTimeMs,
      }),
    });
    const d: Resp = await r.json();
    if (!r.ok) {
      setErrMsg("Something went wrong scoring that answer.");
      return setPhase("error");
    }
    setFeedback(d);
    setNumCompleted(d.numCompleted);
    setNumCorrect(d.numCorrect);
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
        <p className="muted">Loading this topic…</p>
      </Shell>
    );

  if (phase === "error")
    return (
      <Shell>
        <h2>Hmm.</h2>
        <p className="sub">{errMsg}</p>
        <Link href={`/practice/${studentId}/topics`} className="btn">
          Back to topics
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
          <div className="stat-big">{total > 0 ? `${numCorrect}/${total}` : "All clear"}</div>
          <p className="sub" style={{ marginTop: "0.4rem" }}>
            {topicName ? `${topicName} practice` : "Topic practice"}
          </p>
          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "center", flexWrap: "wrap", marginTop: "1rem" }}>
            <Link href={`/practice/${studentId}/topics`} className="btn">
              More topics
            </Link>
          </div>
        </div>
      </Shell>
    );

  return (
    <Shell>
      <div className="progress">
        <div style={{ width: `${total ? (numCompleted / total) * 100 : 0}%` }} />
      </div>
      <p className="muted">
        {topicName} · question {numCompleted + 1} of {total}
      </p>
      <h2 style={{ marginTop: "0.25rem" }}>{question?.stem}</h2>
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
