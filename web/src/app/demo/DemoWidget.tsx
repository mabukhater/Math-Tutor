"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Check, Cross } from "@/components/icons";
import { QuestionVisual, type Visual } from "@/components/QuestionVisual";

interface DemoQ {
  id: string;
  stem: string;
  options: string[];
  visual: Visual | null;
  skillCode: string;
  curriculum: string;
}
// Server grades and returns the answer only after the visitor picks — the
// answer key is never shipped to the browser up front.
interface DemoResult {
  correct: boolean;
  correctIndex: number;
  whyWrong: string | null;
  correctExplanation: string | null;
}
const LETTERS = ["A", "B", "C", "D"];

export default function DemoWidget() {
  const [questions, setQuestions] = useState<DemoQ[]>([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setIdx(0);
    setSelected(null);
    setResult(null);
    setCorrectCount(0);
    const r = await fetch("/api/demo");
    const d = await r.json();
    setQuestions(r.ok ? d.questions : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return <p className="muted">Loading a few sample questions…</p>;
  if (questions.length === 0)
    return <p className="muted">No sample questions available right now.</p>;

  const done = idx >= questions.length;
  if (done)
    return (
      <div className="celebrate" style={{ textAlign: "center" }}>
        <div className="stat-big">
          {correctCount}/{questions.length}
        </div>
        <p className="sub" style={{ marginTop: "0.4rem" }}>
          That&apos;s the idea — in the real thing, questions adapt to your child&apos;s level.
        </p>
        <div style={{ display: "flex", gap: "0.6rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/login" className="btn-cta">
            Start free
          </Link>
          <button className="btn-soft" onClick={load}>
            Try more
          </button>
        </div>
      </div>
    );

  const q = questions[idx];

  async function choose(i: number) {
    if (selected !== null) return; // lock once a choice is made / grading in flight
    setSelected(i);
    const r = await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: q.id, selectedIndex: i }),
    });
    if (!r.ok) {
      setSelected(null); // let them try again
      return;
    }
    const d: DemoResult = await r.json();
    setResult(d);
    if (d.correct) setCorrectCount((c) => c + 1);
  }
  function next() {
    setSelected(null);
    setResult(null);
    setIdx((i) => i + 1);
  }

  return (
    <div>
      <div className="progress">
        <div style={{ width: `${(idx / questions.length) * 100}%` }} />
      </div>
      <p className="muted">
        {q.curriculum} · {q.skillCode} · sample {idx + 1} of {questions.length}
      </p>
      <h2 style={{ marginTop: "0.25rem" }}>{q.stem}</h2>
      {q.visual && <QuestionVisual visual={q.visual} />}
      {q.options.map((opt, i) => {
        let cls = "opt";
        if (result && i === result.correctIndex) cls += " correct";
        else if (result && i === selected) cls += " wrong";
        return (
          <button
            key={i}
            className={cls}
            disabled={selected !== null}
            onClick={() => choose(i)}
          >
            <span className="opt-letter">{LETTERS[i]}</span>
            {opt}
            {result && i === result.correctIndex && (
              <span className="opt-mark">
                <Check size={20} />
              </span>
            )}
            {result && i === selected && i !== result.correctIndex && (
              <span className="opt-mark">
                <Cross size={20} />
              </span>
            )}
          </button>
        );
      })}
      {result && (
        <div className="feedback-box">
          <div className={"feedback-line " + (result.correct ? "ok" : "no")}>
            {result.correct ? <Check size={20} /> : <Cross size={20} />}
            {result.correct ? "Correct!" : "Not quite"}
          </div>
          {!result.correct && result.whyWrong && (
            <p className="why-wrong">{result.whyWrong}</p>
          )}
          {!result.correct && (
            <p style={{ marginTop: "0.5rem", fontWeight: 700 }}>
              The answer is {LETTERS[result.correctIndex]}: {q.options[result.correctIndex]}
            </p>
          )}
          {result.correctExplanation && (
            <p className="muted" style={{ marginTop: "0.3rem" }}>
              {result.correctExplanation}
            </p>
          )}
          <button className="btn" onClick={next}>
            {idx + 1 >= questions.length ? "See result" : "Next question"}
          </button>
        </div>
      )}
    </div>
  );
}
