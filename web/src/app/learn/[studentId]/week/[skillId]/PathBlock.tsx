"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Cross, Trophy } from "@/components/icons";
import { Markdown } from "@/components/Markdown";
import { QuestionVisual, type Visual } from "@/components/QuestionVisual";
import { QuestionNav } from "@/components/QuestionNav";
import { QuestionTags, difficultyTag } from "@/components/QuestionTags";

const LETTERS = ["A", "B", "C", "D"];

interface Question {
  id: string;
  stem: string;
  options: string[];
  visual?: Visual | null;
  difficulty?: number | null;
}
interface Lesson {
  title: string;
  body: string;
}
// A question the child has finished, kept so they can jump back and review it.
interface Answered {
  stem: string;
  options: string[];
  visual?: Visual | null;
  selectedIndex: number;
  correctIndex: number;
  correct: boolean;
  whyWrong?: string | null;
  explanation?: string;
  correctExplanation?: string | null;
}
// Normalized shape the option list + feedback box render from (live or review).
interface QView {
  stem: string;
  options: string[];
  visual?: Visual | null;
  answered: boolean;
  selected: number | null;
  correctIndex?: number;
  correct?: boolean;
  whyWrong?: string | null;
  explanation?: string;
  correctExplanation?: string | null;
}
type Phase = "loading" | "learn" | "question" | "feedback" | "result" | "error";

interface Resp {
  blockId?: string;
  skillName?: string;
  tags?: { grade: string; curriculum: string; topic: string } | null;
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
  grade?: number;
  answered?: Answered[];
  error?: string;
}

export default function PathBlock({ studentId, skillId }: { studentId: string; skillId: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [errMsg, setErrMsg] = useState("");
  const [blockId, setBlockId] = useState("");
  const [skillName, setSkillName] = useState("");
  const [tags, setTags] = useState<{ grade: string; curriculum: string; topic: string } | null>(null);
  const [lessonRevisit, setLessonRevisit] = useState(false);
  const [young, setYoung] = useState(false);
  const [threshold, setThreshold] = useState(80);
  const [total, setTotal] = useState(0);
  const [numCompleted, setNumCompleted] = useState(0);
  const [numCorrect, setNumCorrect] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Resp | null>(null);
  const [result, setResult] = useState<Resp | null>(null);
  const [history, setHistory] = useState<Answered[]>([]);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [limited, setLimited] = useState(false);
  const shownAt = useRef(0);
  // Guards against a second answer firing while the first is still in flight.
  // Without it, a slow request leaves the options interactive (phase stays
  // "question"), so a second confirm sends a duplicate POST — the server has
  // already advanced, so the duplicate 409s and surfaces as a scoring error.
  const submitting = useRef(false);

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
        if (d.error === "limit") {
          setLimited(true);
          setErrMsg(
            "You’ve finished today’s free lesson! 🎉 Come back tomorrow, or ask a grown-up to upgrade for unlimited practice.",
          );
          return setPhase("error");
        }
        setErrMsg(
          d.error === "locked"
            ? "Finish the earlier weeks first — this one isn’t unlocked yet."
            : d.error === "no_questions"
              ? "This week doesn’t have questions yet. Check back soon."
              : "Couldn’t load this week. Please try again.",
        );
        return setPhase("error");
      }
      setLimited(false);
      setBlockId(d.blockId ?? "");
      setSkillName(d.skillName ?? "");
      setTags(d.tags ?? null);
      setLessonRevisit(false);
      setYoung((d.grade ?? 9) <= 3);
      setThreshold(d.threshold);
      setTotal(d.total);
      setNumCompleted(d.numCompleted);
      setNumCorrect(d.numCorrect);
      setLesson(d.lesson ?? null);
      setQuestion(d.question ?? null);
      setSelected(null);
      setFeedback(null);
      setResult(null);
      setHistory(d.answered ?? []); // seed history so a resumed block is consistent
      setReviewIndex(null);
      setPhase(d.lesson && !skipLesson ? "learn" : "question");
    },
    [studentId, skillId],
  );

  useEffect(() => {
    start();
  }, [start]);

  async function answer(i: number) {
    if (phase !== "question" || !question || submitting.current) return;
    submitting.current = true;
    setSelected(i);
    const responseTimeMs = shownAt.current ? Date.now() - shownAt.current : null;
    try {
      const r = await fetch("/api/path/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, blockId, questionId: question.id, selectedIndex: i, responseTimeMs }),
      });
      const d: Resp = await r.json().catch(() => ({}) as Resp);
      if (!r.ok) {
        // Surface the real status/code so a recurrence is diagnosable rather
        // than collapsing every failure into one opaque message.
        console.error("path/answer failed", { status: r.status, error: d.error });
        setErrMsg("Something went wrong scoring that answer.");
        return setPhase("error");
      }
      setFeedback(d);
      setNumCompleted(d.numCompleted);
      setNumCorrect(d.numCorrect);
      setPhase("feedback");
    } finally {
      submitting.current = false;
    }
  }

  function next() {
    if (!feedback || !question) return;
    // Archive the question we just finished so it stays reviewable.
    setHistory((h) => [
      ...h,
      {
        stem: question.stem,
        options: question.options,
        visual: question.visual ?? null,
        selectedIndex: selected ?? -1,
        correctIndex: feedback.correctIndex ?? -1,
        correct: !!feedback.correct,
        whyWrong: feedback.whyWrong,
        explanation: feedback.explanation,
        correctExplanation: feedback.correctExplanation,
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
    setPhase("question");
  }

  // Click a chip: a past question opens its review; the live chip resumes play.
  function jump(i: number) {
    setReviewIndex(i >= history.length ? null : i);
  }

  if (phase === "loading")
    return (
      <Shell exitHref={`/learn/${studentId}`} young={young}>
        <p className="muted">Loading this week…</p>
      </Shell>
    );

  if (phase === "error")
    return (
      <Shell exitHref={`/learn/${studentId}`} young={young}>
        <h2>{limited ? "That’s today’s free lesson!" : "Hmm."}</h2>
        <p className="sub">{errMsg}</p>
        {limited && (
          <Link href="/pricing" className="btn">
            See plans →
          </Link>
        )}
        <p style={{ marginTop: limited ? "0.75rem" : 0, textAlign: "center" }}>
          <Link href={`/learn/${studentId}`} className="muted">
            Back to path
          </Link>
        </p>
      </Shell>
    );

  if (phase === "learn" && lesson)
    return (
      <Shell exitHref={`/learn/${studentId}`} young={young}>
        <span className="badge">Learn · {skillName}</span>
        <h1 style={{ marginTop: "0.5rem" }}>{lesson.title}</h1>
        <div className="article" style={{ marginTop: "0.5rem" }}>
          <Markdown content={lesson.body} />
        </div>
        <button
          className="btn"
          style={{ marginTop: "1rem" }}
          onClick={() => {
            setLessonRevisit(false);
            setPhase("question");
          }}
        >
          {lessonRevisit ? "Resume →" : `Start the ${total} questions`}
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
      <p className="q-skill">{skillName}</p>
      {tags && (
        <QuestionTags
          items={[
            { label: tags.grade },
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

  // Reviewing a finished question (read-only), reachable from any phase.
  if (reviewing) {
    const a = history[reviewIndex!];
    const view: QView = { ...a, answered: true, selected: a.selectedIndex };
    return (
      <Shell exitHref={`/learn/${studentId}`} young={young}>
        {header}
        <div className="review-banner">
          <span>Reviewing question {reviewIndex! + 1}</span>
          <button className="review-resume" onClick={() => setReviewIndex(null)}>
            {phase === "result" ? "Back to results" : "Resume →"}
          </button>
        </div>
        <h2 style={{ marginTop: "0.25rem" }}>{view.stem}</h2>
        {view.visual && <QuestionVisual visual={view.visual} />}
        <OptionList view={view} interactive={false} />
        <FeedbackBox view={view} />
      </Shell>
    );
  }

  if (phase === "result" && result) {
    const passed = result.passed === true;
    return (
      <Shell exitHref={`/learn/${studentId}`} young={young}>
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
                You reached the {result.threshold}% your parent set to pass — the next week is
                unlocked. Tap any question above to review it.
              </p>
              <Link href={`/learn/${studentId}`} className="btn" style={{ marginTop: "0.5rem" }}>
                Back to path
              </Link>
            </>
          ) : (
            <>
              <p className="sub" style={{ marginTop: "0.75rem" }}>
                You need {result.threshold}% to pass this week (your parent sets this). Tap the red
                questions above to see what to fix, then try a fresh set.
              </p>
              <button className="btn" style={{ marginTop: "0.5rem" }} onClick={() => start(true)}>
                Try a new set
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

  // Live question / feedback.
  const liveView: QView = {
    stem: question?.stem ?? "",
    options: question?.options ?? [],
    visual: question?.visual,
    answered: phase === "feedback",
    selected,
    correctIndex: feedback?.correctIndex,
    correct: feedback?.correct,
    whyWrong: feedback?.whyWrong,
    explanation: feedback?.explanation,
    correctExplanation: feedback?.correctExplanation,
  };

  return (
    <Shell exitHref={`/learn/${studentId}`} young={young}>
      {header}
      <h2 style={{ marginTop: "0.25rem" }}>{question?.stem}</h2>
      {question?.visual && <QuestionVisual visual={question.visual} />}
      <OptionList view={liveView} interactive={phase === "question"} onPick={answer} />
      {phase === "question" && lesson && (
        <button
          className="q-link"
          type="button"
          onClick={() => {
            setLessonRevisit(true);
            setPhase("learn");
          }}
        >
          ← Go back to lesson
        </button>
      )}
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

function FeedbackBox({ view }: { view: QView }) {
  return (
    <div className="feedback-box">
      <div className={"feedback-line " + (view.correct ? "ok" : "no")}>
        {view.correct ? <Check size={20} /> : <Cross size={20} />}
        {view.correct ? "Correct!" : "Not quite"}
      </div>
      {!view.correct && view.whyWrong && <p className="why-wrong">{view.whyWrong}</p>}
      {!view.correct && typeof view.correctIndex === "number" && (
        <p style={{ marginTop: "0.5rem", fontWeight: 700 }}>
          The answer is {LETTERS[view.correctIndex]}: {view.options[view.correctIndex]}
        </p>
      )}
      <p className="muted" style={{ marginTop: "0.3rem" }}>
        {view.correct ? view.explanation : view.correctExplanation ?? view.explanation}
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
