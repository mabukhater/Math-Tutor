"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Draft {
  id: string;
  stem: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: number;
  skill_code: string;
  grade: number;
}
const LETTERS = ["A", "B", "C", "D"];

export default function VetClient() {
  const [scope, setScope] = useState<{ grade: string; onePerSkill: boolean }>({
    grade: "",
    onePerSkill: true,
  });
  const [queue, setQueue] = useState<Draft[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [vetted, setVetted] = useState(0);
  const [retired, setRetired] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setIdx(0);
    setVetted(0);
    setRetired(0);
    const params = new URLSearchParams();
    if (scope.grade) params.set("grade", scope.grade);
    if (scope.onePerSkill) params.set("one_per_skill", "1");
    const r = await fetch(`/api/admin/vet?${params}`);
    const data = await r.json();
    setQueue(r.ok ? data.questions : []);
    setLoading(false);
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = useCallback(
    async (status: "vetted" | "retired" | "skip") => {
      if (busy) return;
      const q = queue[idx];
      if (!q) return;
      if (status !== "skip") {
        setBusy(true);
        await fetch("/api/admin/vet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId: q.id, status }),
        });
        setBusy(false);
        if (status === "vetted") setVetted((n) => n + 1);
        else setRetired((n) => n + 1);
      }
      setIdx((i) => i + 1);
    },
    [busy, queue, idx],
  );

  // Keyboard: v / r / s
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "v") decide("vetted");
      else if (e.key === "r") decide("retired");
      else if (e.key === "s") decide("skip");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide]);

  if (loading)
    return (
      <div className="wrap">
        <div className="card">
          <p className="muted">Loading drafts…</p>
        </div>
      </div>
    );

  const q = queue[idx];
  const done = !q;

  return (
    <div className="wrap">
      <div className="card">
        <div className="row" style={{ marginBottom: "0.75rem" }}>
          <h1 style={{ margin: 0, fontSize: "1.3rem" }}>Vet questions</h1>
          <Link href="/dashboard" className="muted">
            Done
          </Link>
        </div>

        <div className="row" style={{ gap: "0.5rem", marginBottom: "1rem" }}>
          <select
            value={scope.grade}
            onChange={(e) => setScope((s) => ({ ...s, grade: e.target.value }))}
            style={{ flex: 1 }}
          >
            <option value="">All grades</option>
            <option value="3">Grade 3</option>
            <option value="4">Grade 4</option>
            <option value="5">Grade 5</option>
          </select>
          <label className="muted" style={{ display: "flex", alignItems: "center", gap: "0.35rem", margin: 0, whiteSpace: "nowrap" }}>
            <input
              type="checkbox"
              checked={scope.onePerSkill}
              style={{ width: "auto" }}
              onChange={(e) => setScope((s) => ({ ...s, onePerSkill: e.target.checked }))}
            />
            one per skill
          </label>
        </div>

        {done ? (
          <div>
            <h2>All caught up 🎉</h2>
            <p className="sub">
              {vetted} vetted, {retired} retired this pass. Vetted questions are live for
              placement and the bot immediately.
            </p>
            <button className="btn" onClick={load}>
              Reload remaining drafts
            </button>
          </div>
        ) : (
          <>
            <div className="progress">
              <div style={{ width: `${(idx / queue.length) * 100}%` }} />
            </div>
            <p className="muted">
              {idx + 1} of {queue.length} · {q.skill_code} · Grade {q.grade} · difficulty {q.difficulty}
            </p>
            <h2 style={{ marginTop: "0.4rem" }}>{q.stem}</h2>
            {q.options.map((opt, i) => (
              <div key={i} className={"opt" + (i === q.correct_index ? " correct" : "")} style={{ cursor: "default" }}>
                {LETTERS[i]}. {opt}
                {i === q.correct_index ? "  ✓" : ""}
              </div>
            ))}
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              ⓘ {q.explanation}
            </p>
            <div className="row" style={{ gap: "0.6rem", marginTop: "1rem" }}>
              <button className="btn" disabled={busy} onClick={() => decide("vetted")}>
                Keep (v)
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => decide("retired")}>
                Retire (r)
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={() => decide("skip")}>
                Skip (s)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
