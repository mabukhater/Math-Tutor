"use client";

// AI course passage block — wraps the existing reading quiz flow and threads
// the `subject` param so the block/answer API routes know which AI course this
// lesson belongs to. Reuses the same quiz UI as Reading for consistency (AC-2.1).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Cross, Trophy } from "@/components/icons";
import { QuestionNav } from "@/components/QuestionNav";
import { QuestionTags, difficultyTag } from "@/components/QuestionTags";

const LETTERS = ["A", "B", "C", "D"];

interface Para {
  n: number;
  text: string;
}
interface Question {
  id: string;
  stem: string;
  options: string[];
  difficulty?: number | null;
  hintParagraph?: number | null;
}
type Locator = { paragraph: number; hint: string };
interface Answered {
  stem: string;
  options: string[];
  selectedIndex: number;
  correctIndex: number;
  correct: boolean | null;
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
  tags?: { grade: string; curriculum: string; topic: string } | null;
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

function Passage({
  title,
  paragraphs,
  highlight,
}: {
  title: string;
  paragraphs: Para[];
  highlight: number | null;
}) {
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

export default function AIPassageBlock({
  studentId,
  passageId,
  subject,
}: {
  studentId: string;
  passageId: string;
  subject: "ai7" | "ai8";
}) {
  // Back-link points to the correct course ladder.
  const backHref =
    subject === "ai8" ? `/ai/${studentId}/ai8` : `/ai/${studentId}`;

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
  const [tags, setTags] = useState<{ grade: string; curriculum: string; topic: string } | null>(
    null,
  );
  const [hintUsed, setHintUsed] = useState(false);
  const [history, setHistory] = useState<Answered[]>([]);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const shownAt = useRef(0);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [question?.id]);

  const start = useCallback(async () => {
    setPhase("loading");
    // Thread the subject so the block route uses getAICoursePath for membership
    // and checkAiGate for billing (subject-aware block route, ADR §2).
    const r = await fetch("/api/reading/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, passageId, subject }),
    });
    const d: Resp = await r.json();
    if (!r.ok) {
      if (d.error === "limit") {
        setErrMsg("You've finished today's free lesson! Come back tomorrow or ask a grown-up to upgrade.");
        return setPhase("error");
      }
      setErrMsg(
        d.error === "locked"
          ? "Finish the earlier lessons first — this one isn't unlocked yet."
          : d.error === "no_questions"
            ? "This lesson doesn't have questions yet."
            : "Couldn't load this lesson. Please try again.",
      );
      return setPhase("error");
    }
    setBlockId(d.blockId ?? "");
    setTitle(d.title ?? "");
    setTags(d.tags ?? null);
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
    setHintUsed(false);
    setHistory(d.answered ?? []);
    setReviewIndex(null);
    setPhase(d.numCompleted > 0 ? "question" : "read");
    setShowPassage(d.numCompleted > 0);
  }, [studentId, passageId, subject]);

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
      body: JSON.stringify({
        studentId,
        blockId,
        questionId: question.id,
        selectedIndex: i,
        responseTimeMs,
        hintUsed,
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
    if (d.locator) {
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
    setHintUsed(false);
    setPhase("question");
  }

  function jump(i: number) {
    setReviewIndex(i >= history.length ? null : i);
  }

  if (phase === "loading")
    return (
      <Shell exitHref={backHref}>
        <p className="muted">Loading…</p>
      </Shell>
    );

  if (phase === "error")
    return (
      <Shell exitHref={backHref}>
        <h2>Hmm.</h2>
        <p className="sub">{errMsg}</p>
        <p style={{ textAlign: "center" }}>
          <Link href={backHref} className="muted">
            Back to {subject === "ai8" ? "AI 8" : "AI 7"}
          </Link>
        </p>
      </Shell>
    );

  if (phase === "read")
    return (
      <Shell exitHref={backHref}>
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
          {showPassage ? "Hide lesson" : "Show lesson"}
        </button>
      </div>
      {tags && (
        <QuestionTags
          items={[
            { label: tags.curriculum },
            { label: tags.topic },
            !reviewing && phase !== "result" ? difficultyTag(question?.difficulty) : null,
          ]}
        />
      )}
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

  if (reviewing) {
    const a = history[reviewIndex!];
    const view: QView = { ...a, answered: true, selected: a.selectedIndex };
    return (
      <Shell exitHref={backHref}>
        {header}
        <div className="review-banner">
          <span>Reviewing question {reviewIndex! + 1}</span>
          <button className="review-resume" onClick={() => setReviewIndex(null)}>
            {phase === "result" ? "Back to results" : "Resume →"}
          </button>
        </div>
        {showPassage && (
          <Passage title={title} paragraphs={paragraphs} highlight={view.locator?.paragraph ?? null} />
        )}
        <h2 style={{ marginTop: "0.5rem" }}>{view.stem}</h2>
        <OptionList view={view} interactive={false} />
        <ReadingFeedback view={view} />
      </Shell>
    );
  }

  if (phase === "result" && result) {
    const passed = result.passed === true;
    return (
      <Shell exitHref={backHref}>
        {header}
        <div className="celebrate pop">
          <div
            style={{
              color: passed ? "var(--amber)" : "#c0392b",
              display: "flex",
              justifyContent: "center",
              marginBottom: "0.5rem",
            }}
          >
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
                You reached the {result.threshold}% target — the next lesson is unlocked. Tap any
                question above to review it.
              </p>
              <Link href={backHref} className="btn" style={{ marginTop: "0.5rem" }}>
                Back to {subject === "ai8" ? "AI 8" : "AI 7"}
              </Link>
            </>
          ) : (
            <>
              <p className="sub" style={{ marginTop: "0.75rem" }}>
                You need {result.threshold}% to pass. Tap the red questions above to see what to
                fix, then re-read and retry.
              </p>
              <button className="btn" style={{ marginTop: "0.5rem" }} onClick={start}>
                Read again &amp; retry
              </button>
              <p style={{ marginTop: "0.75rem", textAlign: "center" }}>
                <Link href={backHref} className="muted">
                  Back to {subject === "ai8" ? "AI 8" : "AI 7"}
                </Link>
              </p>
            </>
          )}
        </div>
      </Shell>
    );
  }

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
    <Shell exitHref={backHref}>
      {header}
      {showPassage && <Passage title={title} paragraphs={paragraphs} highlight={highlight} />}
      <h2 style={{ marginTop: "0.5rem" }}>{question?.stem}</h2>
      <OptionList view={liveView} interactive={phase === "question"} onPick={answer} />
      {phase === "question" && question?.hintParagraph != null && (
        <button
          className="q-link"
          type="button"
          onClick={() => {
            setShowPassage(true);
            setHighlight(question.hintParagraph ?? null);
            setHintUsed(true);
          }}
        >
          💡 Get a hint{hintUsed ? " — shown above" : ""}
        </button>
      )}
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

function Shell({ children, exitHref }: { children: React.ReactNode; exitHref?: string }) {
  return (
    <div className="wrap">
      {exitHref && (
        <Link href={exitHref} className="exit-btn" aria-label="Exit">
          ✕ Exit
        </Link>
      )}
      <div className="card">{children}</div>
    </div>
  );
}
