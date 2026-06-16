"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Check, Cross, Trophy } from "@/components/icons";

const LETTERS = ["A", "B", "C", "D"];

interface Question {
  id: string;
  stem: string;
  options: string[];
}
type Phase = "loading" | "question" | "feedback" | "done" | "error";

interface AnswerResp {
  done: boolean;
  correct: boolean;
  explanation: string;
  step?: number;
  question?: Question;
  estimatedIndex?: number;
  placedGrade?: number;
  placedGradeLabel?: string;
  placedSkillName?: string;
}

export default function Placement() {
  const params = useParams<{ studentId: string }>();
  const studentId = params.studentId;

  const [phase, setPhase] = useState<Phase>("loading");
  const [errMsg, setErrMsg] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [question, setQuestion] = useState<Question | null>(null);
  const [step, setStep] = useState(1);
  const [maxSteps, setMaxSteps] = useState(10);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<AnswerResp | null>(null);
  const [result, setResult] = useState<AnswerResp | null>(null);
  const shownAt = useRef(0);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [question?.id]);

  const start = useCallback(async () => {
    setPhase("loading");
    const r = await fetch("/api/placement/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    const data = await r.json();
    if (!r.ok) {
      setErrMsg(
        data.error === "no_vetted_question"
          ? "This curriculum doesn’t have vetted questions yet. Check back soon."
          : "Couldn’t start the placement. Please try again.",
      );
      return setPhase("error");
    }
    setSessionId(data.sessionId);
    setStudentName(data.studentName ?? "");
    setQuestion(data.question);
    setStep(data.step);
    setMaxSteps(data.maxSteps);
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
    const r = await fetch("/api/placement/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, questionId: question.id, selectedIndex: i, responseTimeMs }),
    });
    const data: AnswerResp = await r.json();
    if (!r.ok) {
      setErrMsg("Something went wrong scoring that answer.");
      return setPhase("error");
    }
    setFeedback(data);
    setPhase("feedback");
  }

  function next() {
    if (!feedback) return;
    if (feedback.done) {
      setResult(feedback);
      return setPhase("done");
    }
    setQuestion(feedback.question ?? null);
    setStep(feedback.step ?? step + 1);
    setSelected(null);
    setFeedback(null);
    setPhase("question");
  }

  if (phase === "loading")
    return (
      <div className="wrap">
        <div className="card">
          <p className="muted">Setting up the placement check…</p>
        </div>
      </div>
    );

  if (phase === "error")
    return (
      <div className="wrap">
        <div className="card">
          <h2>Hmm.</h2>
          <p className="sub">{errMsg}</p>
          <Link href="/dashboard" className="btn">
            Back to dashboard
          </Link>
        </div>
      </div>
    );

  if (phase === "done" && result)
    return (
      <div className="wrap">
        <div className="card celebrate pop">
          <div style={{ color: "var(--amber)", display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
            <Trophy size={44} />
          </div>
          <span className="badge">Placement complete</span>
          <h1 style={{ marginTop: "0.6rem" }}>
            We’ve placed {studentName || "your child"} at{" "}
            {result.placedGradeLabel ?? `Grade ${result.placedGrade}`}.
          </h1>
          <p className="sub">
            Starting point: {result.placedSkillName}. Daily practice will begin here and
            adapt as they go.
          </p>
          <Link href={`/children/${studentId}/link`} className="btn">
            Link Telegram for daily practice
          </Link>
          <p style={{ marginTop: "1rem", textAlign: "center" }}>
            <Link href="/dashboard" className="muted">
              Back to dashboard
            </Link>
          </p>
        </div>
      </div>
    );

  // question / feedback
  return (
    <div className="wrap">
      <div className="card">
        <div className="progress">
          <div style={{ width: `${(step / maxSteps) * 100}%` }} />
        </div>
        <p className="muted">Question {step}</p>
        <h2 style={{ marginTop: "0.25rem" }}>{question?.stem}</h2>

        {question?.options.map((opt, i) => {
          let cls = "opt";
          const showMark = phase === "feedback" && selected === i;
          if (showMark) cls += feedback?.correct ? " correct" : " wrong";
          return (
            <button
              key={i}
              className={cls}
              disabled={phase === "feedback"}
              onClick={() => answer(i)}
            >
              <span className="opt-letter">{LETTERS[i]}</span>
              {opt}
              {showMark && (
                <span className="opt-mark">
                  {feedback?.correct ? <Check size={20} /> : <Cross size={20} />}
                </span>
              )}
            </button>
          );
        })}

        {phase === "feedback" && feedback && (
          <>
            <div className={"feedback-line " + (feedback.correct ? "ok" : "no")}>
              {feedback.correct ? <Check size={20} /> : <Cross size={20} />}
              {feedback.correct ? "Correct!" : "Not quite"}
            </div>
            <p className="muted" style={{ marginTop: "0.3rem" }}>{feedback.explanation}</p>
            <button className="btn" onClick={next}>
              {feedback.done ? "See result" : "Next question"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
