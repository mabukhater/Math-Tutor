"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Cross, Trophy } from "@/components/icons";

const LETTERS = ["A", "B", "C", "D"];

interface Para {
  n: number;
  text: string;
}
interface Question {
  id: string;
  stem: string;
  options: string[];
}
type Phase = "loading" | "read" | "question" | "feedback" | "result" | "error";

interface Resp {
  blockId?: string;
  title?: string;
  paragraphs?: Para[];
  threshold: number;
  total: number;
  numCompleted: number;
  numCorrect: number;
  question?: Question | null;
  next?: Question | null;
  correct?: boolean;
  correctIndex?: number;
  explanation?: string;
  locator?: { paragraph: number; hint: string } | null;
  blockDone?: boolean;
  passed?: boolean | null;
  accuracy?: number;
  error?: string;
}

function Passage({ title, paragraphs, highlight }: { title: string; paragraphs: Para[]; highlight: number | null }) {
  return (
    <div className="rc-passage">
      <div className="rc-passage-title">{title}</div>
      {paragraphs.map((p) => (
        <p key={p.n} className={"rc-para" + (highlight === p.n ? " hl" : "")}>
          <span className="rc-pnum">¶{p.n}</span>
          {p.text}
        </p>
      ))}
    </div>
  );
}

export default function ReadingBlock({ studentId, passageId }: { studentId: string; passageId: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [errMsg, setErrMsg] = useState("");
  const [blockId, setBlockId] = useState("");
  const [title, setTitle] = useState("");
  const [paragraphs, setParagraphs] = useState<Para[]>([]);
  const [threshold, setThreshold] = useState(80);
  const [total, setTotal] = useState(0);
  const [numCompleted, setNumCompleted] = useState(0);
  const [numCorrect, setNumCorrect] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Resp | null>(null);
  const [result, setResult] = useState<Resp | null>(null);
  const [showPassage, setShowPassage] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);
  const shownAt = useRef(0);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [question?.id]);

  const start = useCallback(async () => {
    setPhase("loading");
    const r = await fetch("/api/reading/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, passageId }),
    });
    const d: Resp = await r.json();
    if (!r.ok) {
      setErrMsg(
        d.error === "locked"
          ? "Finish the earlier passages first — this one isn’t unlocked yet."
          : d.error === "no_questions"
            ? "This passage doesn’t have questions yet."
            : "Couldn’t load this passage. Please try again.",
      );
      return setPhase("error");
    }
    setBlockId(d.blockId ?? "");
    setTitle(d.title ?? "");
    setParagraphs((d.paragraphs ?? []) as Para[]);
    setThreshold(d.threshold);
    setTotal(d.total);
    setNumCompleted(d.numCompleted);
    setNumCorrect(d.numCorrect);
    setQuestion(d.question ?? null);
    setSelected(null);
    setFeedback(null);
    setResult(null);
    setHighlight(null);
    // If they already started, jump back into questions; else read first.
    setPhase(d.numCompleted > 0 ? "question" : "read");
    setShowPassage(d.numCompleted > 0);
  }, [studentId, passageId]);

  useEffect(() => {
    start();
  }, [start]);

  async function answer(i: number) {
    if (phase !== "question" || !question) return;
    setSelected(i);
    const responseTimeMs = shownAt.current ? Date.now() - shownAt.current : null;
    const r = await fetch("/api/reading/answer", {
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
    if (d.locator) {
      // Send them back into the text: open the passage, highlight the paragraph.
      setShowPassage(true);
      setHighlight(d.locator.paragraph);
    }
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
    setHighlight(null);
    setPhase("question");
  }

  if (phase === "loading")
    return (
      <Shell>
        <p className="muted">Loading…</p>
      </Shell>
    );

  if (phase === "error")
    return (
      <Shell>
        <h2>Hmm.</h2>
        <p className="sub">{errMsg}</p>
        <Link href={`/reading/${studentId}`} className="btn">
          Back to reading
        </Link>
      </Shell>
    );

  if (phase === "read")
    return (
      <Shell>
        <span className="badge">Read first</span>
        <Passage title={title} paragraphs={paragraphs} highlight={null} />
        <button className="btn" onClick={() => setPhase("question")}>
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
                Nice reading! The next passage is unlocked.
              </p>
              <Link href={`/reading/${studentId}`} className="btn" style={{ marginTop: "0.5rem" }}>
                Back to reading
              </Link>
            </>
          ) : (
            <>
              <p className="sub" style={{ marginTop: "0.75rem" }}>
                Not quite {result.threshold}% — re-read the passage and try again.
              </p>
              <button className="btn" style={{ marginTop: "0.5rem" }} onClick={start}>
                Read again &amp; retry
              </button>
              <p style={{ marginTop: "0.75rem", textAlign: "center" }}>
                <Link href={`/reading/${studentId}`} className="muted">
                  Back to reading
                </Link>
              </p>
            </>
          )}
        </div>
      </Shell>
    );
  }

  // question / feedback
  return (
    <Shell>
      <div className="progress">
        <div style={{ width: `${total ? (numCompleted / total) * 100 : 0}%` }} />
      </div>
      <div className="rc-bar">
        <span className="muted">
          {title} · question {numCompleted + 1} of {total} · pass at {threshold}%
        </span>
        <button className="rc-toggle" onClick={() => setShowPassage((s) => !s)}>
          {showPassage ? "Hide passage" : "Show passage"}
        </button>
      </div>

      {showPassage && <Passage title={title} paragraphs={paragraphs} highlight={highlight} />}

      <h2 style={{ marginTop: "0.5rem" }}>{question?.stem}</h2>
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
          {!feedback.correct && feedback.locator && (
            <p className="why-wrong">
              <strong>Look again at ¶{feedback.locator.paragraph}.</strong> {feedback.locator.hint}
            </p>
          )}
          {!feedback.correct && typeof feedback.correctIndex === "number" && question && (
            <p style={{ marginTop: "0.5rem", fontWeight: 700 }}>
              The answer is {LETTERS[feedback.correctIndex]}: {question.options[feedback.correctIndex]}
            </p>
          )}
          <p className="muted" style={{ marginTop: "0.3rem" }}>
            {feedback.explanation}
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
