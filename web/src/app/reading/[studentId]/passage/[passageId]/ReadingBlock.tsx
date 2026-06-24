"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Cross, Trophy } from "@/components/icons";
import { QuestionNav } from "@/components/QuestionNav";

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
type Locator = { paragraph: number; hint: string };
// A finished question, kept so the child can jump back and review it.
interface Answered {
  stem: string;
  options: string[];
  selectedIndex: number;
  correctIndex: number;
  correct: boolean | null; // null = answered in an earlier session, result not recorded
  locator?: Locator | null;
  explanation?: string;
}
interface QView {
  stem: string;
  options: string[];
  answered: boolean;
  selected: number | null;
  correctIndex?: number;
  correct?: boolean | null;
  locator?: Locator | null;
  explanation?: string;
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
  locator?: Locator | null;
  blockDone?: boolean;
  passed?: boolean | null;
  accuracy?: number;
  grade?: number;
  answered?: Answered[];
  error?: string;
}

function Passage({ title, paragraphs, highlight }: { title: string; paragraphs: Para[]; highlight: number | null }) {
  return (
    <div className="rc-passage">
      <div className="rc-passage-title">{title}</div>
      {paragraphs.map((p) => (
        <p key={p.n} className={"rc-para" + (highlight === p.n ? " hl" : "")}>
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
  const [young, setYoung] = useState(false);
  const [history, setHistory] = useState<Answered[]>([]);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [limited, setLimited] = useState(false);
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
      if (d.error === "limit") {
        setLimited(true);
        setErrMsg(
          "You’ve finished today’s free passage! 🎉 Come back tomorrow, or ask a grown-up to upgrade for unlimited reading.",
        );
        return setPhase("error");
      }
      setErrMsg(
        d.error === "locked"
          ? "Finish the earlier passages first — this one isn’t unlocked yet."
          : d.error === "no_questions"
            ? "This passage doesn’t have questions yet."
            : "Couldn’t load this passage. Please try again.",
      );
      return setPhase("error");
    }
    setLimited(false);
    setBlockId(d.blockId ?? "");
    setTitle(d.title ?? "");
    setParagraphs((d.paragraphs ?? []) as Para[]);
    setYoung((d.grade ?? 9) <= 3);
    setThreshold(d.threshold);
    setTotal(d.total);
    setNumCompleted(d.numCompleted);
    setNumCorrect(d.numCorrect);
    setQuestion(d.question ?? null);
    setSelected(null);
    setFeedback(null);
    setResult(null);
    setHighlight(null);
    setHistory(d.answered ?? []); // seed history so a resumed block is consistent
    setReviewIndex(null);
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
    if (!feedback || !question) return;
    setHistory((h) => [
      ...h,
      {
        stem: question.stem,
        options: question.options,
        selectedIndex: selected ?? -1,
        correctIndex: feedback.correctIndex ?? -1,
        correct: !!feedback.correct,
        locator: feedback.locator ?? null,
        explanation: feedback.explanation,
      },
    ]);
    if (feedback.blockDone) {
      setResult(feedback);
      setSelected(null);
      setFeedback(null);
      return setPhase("result");
    }
    setQuestion(feedback.next ?? null);
    setSelected(null);
    setFeedback(null);
    setHighlight(null);
    setPhase("question");
  }

  function jump(i: number) {
    setReviewIndex(i >= history.length ? null : i);
  }

  if (phase === "loading")
    return (
      <Shell exitHref={`/reading/${studentId}`} young={young}>
        <p className="muted">Loading…</p>
      </Shell>
    );

  if (phase === "error")
    return (
      <Shell exitHref={`/reading/${studentId}`} young={young}>
        <h2>{limited ? "That’s today’s free passage!" : "Hmm."}</h2>
        <p className="sub">{errMsg}</p>
        {limited && (
          <Link href="/pricing" className="btn">
            See plans →
          </Link>
        )}
        <p style={{ marginTop: limited ? "0.75rem" : 0, textAlign: "center" }}>
          <Link href={`/reading/${studentId}`} className="muted">
            Back to reading
          </Link>
        </p>
      </Shell>
    );

  if (phase === "read")
    return (
      <Shell exitHref={`/reading/${studentId}`} young={young}>
        <span className="badge">Read first</span>
        <Passage title={title} paragraphs={paragraphs} highlight={null} />
        <button className="btn" onClick={() => setPhase("question")}>
          Start the {total} questions
        </button>
      </Shell>
    );

  const liveIndex = history.length;
  const results = history.map((h) => h.correct);
  const reviewing = reviewIndex !== null && reviewIndex < history.length;
  // Only ring a chip when actually reviewing a past one; during live play the
  // current chip keeps its own (green) highlight.
  const viewIndex = reviewing ? reviewIndex! : -1;

  const header = (
    <>
      <div className="q-head">
        <div className="progress">
          <div style={{ width: `${total ? (numCompleted / total) * 100 : 0}%` }} />
        </div>
        <span className="q-count">
          {phase === "result" ? "Complete" : `Question ${Math.min(liveIndex + 1, total)} of ${total}`}
        </span>
      </div>
      <div className="rc-bar">
        <span className="q-skill">{title}</span>
        <button className="rc-toggle" onClick={() => setShowPassage((s) => !s)}>
          {showPassage ? "Hide passage" : "Show passage"}
        </button>
      </div>
      {total > 0 && (
        <QuestionNav
          total={total}
          results={results}
          liveIndex={phase === "result" ? -1 : liveIndex}
          viewIndex={viewIndex}
          onJump={jump}
        />
      )}
    </>
  );

  // Reviewing a finished question (read-only).
  if (reviewing) {
    const a = history[reviewIndex!];
    const view: QView = { ...a, answered: true, selected: a.selectedIndex };
    return (
      <Shell exitHref={`/reading/${studentId}`} young={young}>
        {header}
        <div className="review-banner">
          <span>Reviewing question {reviewIndex! + 1}</span>
          <button className="review-resume" onClick={() => setReviewIndex(null)}>
            {phase === "result" ? "Back to results" : "Resume →"}
          </button>
        </div>
        {showPassage && <Passage title={title} paragraphs={paragraphs} highlight={view.locator?.paragraph ?? null} />}
        <h2 style={{ marginTop: "0.5rem" }}>{view.stem}</h2>
        <OptionList view={view} interactive={false} />
        <ReadingFeedback view={view} />
      </Shell>
    );
  }

  if (phase === "result" && result) {
    const passed = result.passed === true;
    return (
      <Shell exitHref={`/reading/${studentId}`} young={young}>
        {header}
        <div className="celebrate pop">
          <div style={{ color: passed ? "var(--amber)" : "#c0392b", display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
            {passed ? <Trophy size={44} /> : <Cross size={40} />}
          </div>
          <h2 style={{ marginBottom: "0.15rem" }}>{passed ? "You passed! 🎉" : "Try again"}</h2>
          <div className="stat-big">{result.accuracy}%</div>
          <p className="sub" style={{ marginTop: "0.4rem" }}>
            {result.numCorrect} of {result.total} correct
          </p>
          {passed ? (
            <>
              <p className="sub" style={{ marginTop: "0.75rem" }}>
                You reached the {result.threshold}% your parent set to pass — the next passage is
                unlocked. Tap any question above to review it.
              </p>
              <Link href={`/reading/${studentId}`} className="btn" style={{ marginTop: "0.5rem" }}>
                Back to reading
              </Link>
            </>
          ) : (
            <>
              <p className="sub" style={{ marginTop: "0.75rem" }}>
                You need {result.threshold}% to pass (your parent sets this). Tap the red questions
                above to see what to fix, then re-read and try again.
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

  // Live question / feedback.
  const liveView: QView = {
    stem: question?.stem ?? "",
    options: question?.options ?? [],
    answered: phase === "feedback",
    selected,
    correctIndex: feedback?.correctIndex,
    correct: feedback?.correct,
    locator: feedback?.locator,
    explanation: feedback?.explanation,
  };

  return (
    <Shell exitHref={`/reading/${studentId}`} young={young}>
      {header}
      {showPassage && <Passage title={title} paragraphs={paragraphs} highlight={highlight} />}
      <h2 style={{ marginTop: "0.5rem" }}>{question?.stem}</h2>
      <OptionList view={liveView} interactive={phase === "question"} onPick={answer} />
      {phase === "feedback" && feedback && (
        <>
          <ReadingFeedback view={liveView} />
          <button className="btn" onClick={next}>
            {feedback.blockDone ? "See result" : "Next question"}
          </button>
        </>
      )}
    </Shell>
  );
}

function OptionList({
  view,
  interactive,
  onPick,
}: {
  view: QView;
  interactive: boolean;
  onPick?: (i: number) => void;
}) {
  // Two-step select: first tap arms (highlights) an option, a second tap on the
  // SAME option confirms — so an accidental tap can't submit. Reset on confirm,
  // and the only way past a question is to confirm, so each one starts clean.
  const [armed, setArmed] = useState<number | null>(null);
  return (
    <>
      {view.options.map((opt, i) => {
        let cls = "opt";
        const isCorrect = view.answered && i === view.correctIndex;
        const isWrongPick = view.answered && i === view.selected && i !== view.correctIndex;
        const isArmed = interactive && !view.answered && armed === i;
        if (isCorrect) cls += " correct";
        else if (isWrongPick) cls += " wrong";
        if (isArmed) cls += " armed";
        return (
          <button
            key={i}
            className={cls}
            disabled={!interactive || view.answered}
            onClick={() => {
              if (!interactive || view.answered) return;
              if (armed === i) {
                setArmed(null);
                onPick?.(i);
              } else {
                setArmed(i);
              }
            }}
          >
            <span className="opt-letter">{LETTERS[i]}</span>
            {opt}
            {isArmed && <span className="opt-confirm">Click to confirm</span>}
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
    </>
  );
}

function ReadingFeedback({ view }: { view: QView }) {
  const unknown = view.correct === null || view.correct === undefined;
  return (
    <div className="feedback-box">
      <div className={"feedback-line" + (unknown ? "" : view.correct ? " ok" : " no")}>
        {!unknown && (view.correct ? <Check size={20} /> : <Cross size={20} />)}
        {unknown ? "Review" : view.correct ? "Correct!" : "Not quite"}
      </div>
      {!view.correct && view.locator && (
        <p className="why-wrong">
          <strong>Look again at paragraph {view.locator.paragraph}.</strong>{" "}
          {view.locator.hint.replace(/¶\s*(\d+)/g, "paragraph $1").replace(/¶/g, "")}
        </p>
      )}
      {!view.correct && typeof view.correctIndex === "number" && (
        <p style={{ marginTop: "0.5rem", fontWeight: 700 }}>
          The answer is {LETTERS[view.correctIndex]}: {view.options[view.correctIndex]}
        </p>
      )}
      <p className="muted" style={{ marginTop: "0.3rem" }}>
        {view.explanation}
      </p>
    </div>
  );
}

function Shell({
  children,
  exitHref,
  young,
}: {
  children: React.ReactNode;
  exitHref?: string;
  young?: boolean;
}) {
  return (
    <div className="wrap">
      {exitHref && (
        <Link href={exitHref} className="exit-btn" aria-label="Exit">
          ✕ Exit
        </Link>
      )}
      <div className={"card" + (young ? " young" : "")}>{children}</div>
    </div>
  );
}
