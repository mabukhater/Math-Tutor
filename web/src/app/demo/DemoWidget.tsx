"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Check, Cross } from "@/components/icons";
import { QuestionVisual, type Visual } from "@/components/QuestionVisual";

interface DemoQ {
  id: string;
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  optionExplanations: string[] | null;
  visual: Visual | null;
  skillCode: string;
  curriculum: string;
}
const LETTERS = ["A", "B", "C", "D"];

export default function DemoWidget() {
  const [questions, setQuestions] = useState<DemoQ[]>([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setIdx(0);
    setSelected(null);
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
  const answered = selected !== null;

  function choose(i: number) {
    if (answered) return;
    setSelected(i);
    if (i === q.correctIndex) setCorrectCount((c) => c + 1);
  }
  function next() {
    setSelected(null);
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
        if (answered && i === q.correctIndex) cls += " correct";
        else if (answered && i === selected) cls += " wrong";
        return (
          <button key={i} className={cls} disabled={answered} onClick={() => choose(i)}>
            <span className="opt-letter">{LETTERS[i]}</span>
            {opt}
            {answered && i === q.correctIndex && (
              <span className="opt-mark">
                <Check size={20} />
              </span>
            )}
            {answered && i === selected && i !== q.correctIndex && (
              <span className="opt-mark">
                <Cross size={20} />
              </span>
            )}
          </button>
        );
      })}
      {answered && (
        <div className="feedback-box">
          <div className={"feedback-line " + (selected === q.correctIndex ? "ok" : "no")}>
            {selected === q.correctIndex ? <Check size={20} /> : <Cross size={20} />}
            {selected === q.correctIndex ? "Correct!" : "Not quite"}
          </div>
          {selected !== q.correctIndex && q.optionExplanations?.[selected as number] && (
            <p className="why-wrong">{q.optionExplanations[selected as number]}</p>
          )}
          {selected !== q.correctIndex && (
            <p style={{ marginTop: "0.5rem", fontWeight: 700 }}>
              The answer is {LETTERS[q.correctIndex]}: {q.options[q.correctIndex]}
            </p>
          )}
          <p className="muted" style={{ marginTop: "0.3rem" }}>
            {q.optionExplanations?.[q.correctIndex] ?? q.explanation}
          </p>
          <button className="btn" onClick={next}>
            {idx + 1 >= questions.length ? "See result" : "Next question"}
          </button>
        </div>
      )}
    </div>
  );
}
