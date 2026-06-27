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

const TIME_LABEL: Record<Time, string> = {
  all: "All time",
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  month: "This month",
};
const OUTCOME_LABEL: Record<Outcome, string> = {
  all: "Any result",
  pass: "Passed",
  fail: "Failed",
  wip: "In progress",
};

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
  const m0 = new Date(now.getFullYear(), now.getMonth(), 1);
  return d >= m0;
}

const FunnelIcon = ({ size = 15 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
  </svg>
);
const Chevron = ({ open }: { open: boolean }) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ transition: "transform .18s", transform: open ? "rotate(180deg)" : "none" }}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

function PillGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { v: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="filt-row">
      <span className="filt-label">{label}</span>
      <div className="filt-pills">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            className={"filt-pill" + (o.v === value ? " on" : "")}
            aria-pressed={o.v === value}
            onClick={() => onChange(o.v)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
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
  const [open, setOpen] = useState(false);

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

  // Active-filter chips (shown when the panel is collapsed).
  const chips: { label: string; clear: () => void }[] = [];
  if (subject !== "all")
    chips.push({ label: subject === "math" ? "Math" : "Reading", clear: () => setSubject("all") });
  if (time !== "all") chips.push({ label: TIME_LABEL[time], clear: () => setTime("all") });
  if (tryN !== "all")
    chips.push({ label: tryN === "4+" ? "Try 4+" : `Try ${tryN}`, clear: () => setTryN("all") });
  if (outcome !== "all") chips.push({ label: OUTCOME_LABEL[outcome], clear: () => setOutcome("all") });
  if (minScore > 0) chips.push({ label: `≥ ${minScore}%`, clear: () => setMinScore(0) });

  const count = chips.length;
  const clearAll = () => {
    setSubject("all");
    setTime("all");
    setTryN("all");
    setOutcome("all");
    setMinScore(0);
  };

  return (
    <>
      <div className="attempt-toolbar">
        <button
          type="button"
          className={"filt-toggle" + (open ? " open" : "") + (count ? " has" : "")}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <FunnelIcon />
          Filters
          {count > 0 && <span className="filt-badge">{count}</span>}
          <Chevron open={open} />
        </button>

        {!open &&
          chips.map((c, i) => (
            <button key={i} type="button" className="filt-chip" onClick={c.clear} title="Remove filter">
              {c.label}
              <span className="filt-x" aria-hidden="true">
                ×
              </span>
            </button>
          ))}
        {!open && count > 0 && (
          <button type="button" className="filt-clear" onClick={clearAll}>
            Clear all
          </button>
        )}
      </div>

      {open && (
        <div className="filt-panel">
          <PillGroup
            label="Subject"
            value={subject}
            onChange={(v) => setSubject(v as Subject)}
            options={[
              { v: "all", label: "All" },
              { v: "math", label: "Math" },
              { v: "reading", label: "Reading" },
            ]}
          />
          <PillGroup
            label="When"
            value={time}
            onChange={(v) => setTime(v as Time)}
            options={[
              { v: "all", label: "All time" },
              { v: "today", label: "Today" },
              { v: "yesterday", label: "Yesterday" },
              { v: "week", label: "This week" },
              { v: "month", label: "This month" },
            ]}
          />
          <PillGroup
            label="Try"
            value={tryN}
            onChange={(v) => setTryN(v as TryN)}
            options={[
              { v: "all", label: "Any" },
              { v: "1", label: "1st" },
              { v: "2", label: "2nd" },
              { v: "3", label: "3rd" },
              { v: "4+", label: "4th+" },
            ]}
          />
          <PillGroup
            label="Result"
            value={outcome}
            onChange={(v) => setOutcome(v as Outcome)}
            options={[
              { v: "all", label: "Any" },
              { v: "pass", label: "Passed" },
              { v: "fail", label: "Failed" },
              { v: "wip", label: "In progress" },
            ]}
          />
          <PillGroup
            label="Min score"
            value={String(minScore)}
            onChange={(v) => setMinScore(Number(v))}
            options={[
              { v: "0", label: "Any" },
              { v: "50", label: "≥50%" },
              { v: "60", label: "≥60%" },
              { v: "70", label: "≥70%" },
              { v: "80", label: "≥80%" },
              { v: "90", label: "≥90%" },
            ]}
          />
          <div className="filt-foot">
            <button type="button" className="filt-clear" onClick={clearAll} disabled={count === 0}>
              Clear all
            </button>
            <button type="button" className="filt-done" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}

      <p className="muted attempt-count">
        {filtered.length} {filtered.length === 1 ? "try" : "tries"}
        {count > 0 ? " match" : ""}
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
