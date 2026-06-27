"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Cross } from "@/components/icons";

export interface TryRow {
  subject: "math" | "reading";
  lessonName: string;
  refId: string;
  n: number; // try number within this lesson (1-based)
  pct: number;
  passed: boolean | null;
  threshold: number;
  date: string; // ISO created_at
}

type Subject = "all" | "math" | "reading";
type Time = "all" | "today" | "yesterday" | "week" | "month";
type TryN = "all" | "1" | "2" | "3" | "4+";
type Outcome = "all" | "pass" | "fail" | "wip";

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Browser-side date math against "now" — fine in a client component.
function inTime(iso: string, range: Time): boolean {
  if (range === "all") return true;
  const d = new Date(iso);
  const now = new Date();
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "today") return d >= today0;
  if (range === "yesterday") {
    const y0 = new Date(today0);
    y0.setDate(y0.getDate() - 1);
    return d >= y0 && d < today0;
  }
  if (range === "week") {
    const dow = (now.getDay() + 6) % 7; // Monday = 0
    const w0 = new Date(today0);
    w0.setDate(w0.getDate() - dow);
    return d >= w0;
  }
  // month
  const m0 = new Date(now.getFullYear(), now.getMonth(), 1);
  return d >= m0;
}

interface Group {
  subject: "math" | "reading";
  refId: string;
  name: string;
  tries: TryRow[];
}

function GroupList({
  groups,
  studentId,
  kind,
  unit,
}: {
  groups: Group[];
  studentId: string;
  kind: string;
  unit: string;
}) {
  if (groups.length === 0)
    return (
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        No {unit} attempts match these filters.
      </p>
    );
  return (
    <div className="attempt-list">
      {groups.map((g) => {
        const scored = g.tries.filter((t) => t.passed !== null).map((t) => t.pct);
        const best = scored.length ? Math.max(...scored) : 0;
        return (
          <Link
            key={g.refId}
            href={`/children/${studentId}/attempts/${kind}/${g.refId}`}
            className="attempt-group link"
          >
            <div className="attempt-group-head">
              <span className="attempt-name">{g.name}</span>
              <span className="muted" style={{ fontSize: "0.8rem" }}>
                {g.tries.length} {g.tries.length === 1 ? "try" : "tries"}
                {best > 0 ? ` · best ${best}%` : ""}
              </span>
            </div>
            <div className="attempt-chips">
              {g.tries.map((a) => {
                const cls = a.passed === null ? "wip" : a.passed ? "pass" : "fail";
                return (
                  <span
                    key={a.n}
                    className={"attempt-chip " + cls}
                    title={`${dateLabel(a.date)} · pass mark ${a.threshold}%`}
                  >
                    <span className="attempt-n">Try {a.n}</span>
                    {a.passed === null ? (
                      <span className="attempt-pct">in progress</span>
                    ) : (
                      <>
                        <span className="attempt-pct">{a.pct}%</span>
                        {a.passed ? <Check size={13} /> : <Cross size={13} />}
                      </>
                    )}
                  </span>
                );
              })}
            </div>
            <div className="attempt-more">See their answers →</div>
          </Link>
        );
      })}
    </div>
  );
}

export function AttemptsExplorer({ rows, studentId }: { rows: TryRow[]; studentId: string }) {
  const [subject, setSubject] = useState<Subject>("all");
  const [time, setTime] = useState<Time>("all");
  const [tryN, setTryN] = useState<TryN>("all");
  const [outcome, setOutcome] = useState<Outcome>("all");
  const [minScore, setMinScore] = useState(0);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (subject !== "all" && r.subject !== subject) return false;
        if (!inTime(r.date, time)) return false;
        if (tryN === "4+" ? r.n < 4 : tryN !== "all" && r.n !== Number(tryN)) return false;
        if (outcome === "pass" && r.passed !== true) return false;
        if (outcome === "fail" && r.passed !== false) return false;
        if (outcome === "wip" && r.passed !== null) return false;
        if (r.pct < minScore) return false;
        return true;
      }),
    [rows, subject, time, tryN, outcome, minScore],
  );

  const groups = useMemo(() => {
    const by = new Map<string, Group>();
    for (const r of filtered) {
      const key = r.subject + ":" + r.refId;
      if (!by.has(key))
        by.set(key, { subject: r.subject, refId: r.refId, name: r.lessonName, tries: [] });
      by.get(key)!.tries.push(r);
    }
    return [...by.values()];
  }, [filtered]);

  const mathGroups = groups.filter((g) => g.subject === "math");
  const readingGroups = groups.filter((g) => g.subject === "reading");
  const active =
    subject !== "all" || time !== "all" || tryN !== "all" || outcome !== "all" || minScore > 0;

  return (
    <>
      <div className="attempt-filters">
        <select value={subject} onChange={(e) => setSubject(e.target.value as Subject)} aria-label="Subject">
          <option value="all">All subjects</option>
          <option value="math">Math</option>
          <option value="reading">Reading</option>
        </select>
        <select value={time} onChange={(e) => setTime(e.target.value as Time)} aria-label="Time">
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
        <select value={tryN} onChange={(e) => setTryN(e.target.value as TryN)} aria-label="Try number">
          <option value="all">Any try</option>
          <option value="1">Try 1</option>
          <option value="2">Try 2</option>
          <option value="3">Try 3</option>
          <option value="4+">Try 4+</option>
        </select>
        <select value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)} aria-label="Result">
          <option value="all">Any result</option>
          <option value="pass">Passed</option>
          <option value="fail">Failed</option>
          <option value="wip">In progress</option>
        </select>
        <select
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          aria-label="Minimum score"
        >
          <option value={0}>Any score</option>
          <option value={50}>≥ 50%</option>
          <option value={60}>≥ 60%</option>
          <option value={70}>≥ 70%</option>
          <option value={80}>≥ 80%</option>
          <option value={90}>≥ 90%</option>
        </select>
        {active && (
          <button
            type="button"
            className="attempt-clear"
            onClick={() => {
              setSubject("all");
              setTime("all");
              setTryN("all");
              setOutcome("all");
              setMinScore(0);
            }}
          >
            Clear
          </button>
        )}
      </div>
      <p className="muted attempt-count">
        {filtered.length} {filtered.length === 1 ? "try" : "tries"}
        {active ? " match" : ""}
      </p>

      {subject !== "reading" && (
        <>
          <h2 className="attempt-sec">Math</h2>
          <GroupList groups={mathGroups} studentId={studentId} kind="math" unit="math" />
        </>
      )}
      {subject !== "math" && (
        <>
          <h2 className="attempt-sec">Reading</h2>
          <GroupList groups={readingGroups} studentId={studentId} kind="reading" unit="reading" />
        </>
      )}
    </>
  );
}
