"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Cross, Trophy } from "@/components/icons";
import { Markdown } from "@/components/Markdown";
import { QuestionVisual, type Visual } from "@/components/QuestionVisual";

const LETTERS = ["A", "B", "C", "D"];

interface Question {
  id: string;
  stem: string;
  options: string[];
  visual?: Visual | null;
}
interface Lesson {
  title: string;
  body: string;
}
type Phase = "loading" | "learn" | "question" | "feedback" | "result" | "error";

interface Resp {
  blockId?: string;
  skillName?: string;
  threshold: number;
  total: number;
  numCompleted: number;
  numCorrect: number;
  lesson?: Lesson | null;
  question?: Question | null;
  next?: Question | null;
  correct?: boolean;
  explanation?: string;
  correctIndex?: number;
  whyWrong?: string | null;
  correctExplanation?: string | null;
  blockDone?: boolean;
  passed?: boolean | null;
  accuracy?: number;
  error?: string;
}

export default function PathBlock({ studentId, skillId }: { studentId: string; skillId: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [errMsg, setErrMsg] = useState("");
  const [blockId, setBlockId] = useState("");
  const [skillName, setSkillName] = useState("");
  const [threshold, setThreshold] = useState(80);
  const [total, setTotal] = useState(0);
  const [numCompleted, setNumCompleted] = useState(0);
  const [numCorrect, setNumCorrect] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Resp | null>(null);
  const [result, setResult] = useState<Resp | null>(null);
  const shownAt = useRef(0);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [question?.id]);

  const start = useCallback(
    async (skipLesson = false) => {
      setPhase("loading");
      const r = await fetch("/api/path/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, skillId }),
      });
      const d: Resp = await r.json();
      if (!r.ok) {
        setErrMsg(
          d.error === "locked"
            ? "Finish the earlier weeks first — this one isn’t unlocked yet."
            : d.error === "no_questions"
              ? "This week doesn’t have questions yet. Check back soon."
              : "Couldn’t load this week. Please try again.",
        );
        return setPhase("error");
      }
      setBlockId(d.blockId ?? "");
      setSkillName(d.skillName ?? "");
      setThreshold(d.threshold);
      setTotal(d.total);
      setNumCompleted(d.numCompleted);
      setNumCorrect(d.numCorrect);
      setLesson(d.lesson ?? null);
      setQuestion(d.question ?? null);
      setSelected(null);
      setFeedback(null);
      setResult(null);
      setPhase(d.lesson && !skipLesson ? "learn" : "question");
    },
    [studentId, skillId],
  );

  useEffect(() => {
    start();
  }, [start]);

  async function answer(i: number) {
    if (phase !== "question" || !question) return;
    setSelected(i);
    const responseTimeMs = shownAt.current ? Date.now() - shownAt.current : null;
    const r = await fetch("/api/path/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, blockId, questionId: question.id, selectedIndex: i, responseTimeMs }),
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
    if (feedback.blockDone) {
      setResult(feedback);
      return setPhase("result");
    }
    setQuestion(feedback.next ?? null);
    setSelected(null);
    setFeedback(null);
    setPhase("question");
  }

  if (phase === "loading")
    return (
      <Shell>
        <p className="muted">Loading this week…</p>
      </Shell>
    );

  if (phase === "error")
    return (
      <Shell>
        <h2>Hmm.</h2>
        <p className="sub">{errMsg}</p>
        <Link href={`/learn/${studentId}`} className="btn">
          Back to path
        </Link>
      </Shell>
    );

  if (phase === "learn" && lesson)
    return (
      <Shell>
        <span className="badge">Learn · {skillName}</span>
        <h1 style={{ marginTop: "0.5rem" }}>{lesson.title}</h1>
        <div className="article" style={{ marginTop: "0.5rem" }}>
          <Markdown content={lesson.body} />
        </div>
        <button className="btn" style={{ marginTop: "1rem" }} onClick={() => setPhase("question")}>
          Start the {total} questions
        </button>
      </Shell>
    );

  if (phase === "result" && result) {
    const passed = result.passed === true;
    return (
      <Shell>
        <div className="celebrate pop">
          <div style={{ color: passed ? "var(--amber)" : "#c0392b", display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
            {passed ? <Trophy size={44} /> : <Cross size={40} />}
          </div>
          <div className="stat-big">{result.accuracy}%</div>
          <p className="sub" style={{ marginTop: "0.4rem" }}>
            {result.numCorrect}/{result.total} correct · pass mark {result.threshold}%
          </p>
          {passed ? (
            <>
              <p className="sub" style={{ marginTop: "0.75rem" }}>
                Week complete! The next week is unlocked.
              </p>
              <Link href={`/learn/${studentId}`} className="btn" style={{ marginTop: "0.5rem" }}>
                Back to path
              </Link>
            </>
          ) : (
            <>
              <p className="sub" style={{ marginTop: "0.75rem" }}>
                Not quite {result.threshold}% yet — let’s try another set and lock it in.
              </p>
              <button className="btn" style={{ marginTop: "0.5rem" }} onClick={() => start(true)}>
                Keep going
              </button>
              <p style={{ marginTop: "0.75rem", textAlign: "center" }}>
                <Link href={`/learn/${studentId}`} className="muted">
                  Back to path
                </Link>
              </p>
            </>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="progress">
        <div style={{ width: `${total ? (numCompleted / total) * 100 : 0}%` }} />
      </div>
      <p className="muted">
        {skillName} · question {numCompleted + 1} of {total} · pass at {threshold}%
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
            {feedback.blockDone ? "See result" : "Next question"}
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
