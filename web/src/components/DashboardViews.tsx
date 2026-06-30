"use client";

import Link from "next/link";
import { useState } from "react";
import { ThresholdControl } from "@/components/ThresholdControl";
import { GradeControl } from "@/components/GradeControl";
import { KidLoginManager } from "@/components/KidLoginManager";
import { DeleteChildButton } from "@/components/DeleteChildButton";

export interface Kid {
  id: string;
  name: string;
  grade: number;
  gradeLabel: string;
  gradeOptions: { grade: number; label: string }[];
  placement: boolean;
  yearPlan: boolean;
  threshold: number;
  username: string | null;
  math: { passed: number; total: number } | null;
  reading: { passed: number; total: number };
  /** AI 7 progress — null means no AI passages published yet. */
  ai7: { passed: number; total: number } | null;
}

type View = "all" | "grade" | "subject" | "progress";
const VIEWS: { id: View; label: string }[] = [
  { id: "all", label: "All cards" },
  { id: "grade", label: "By grade" },
  { id: "subject", label: "By subject" },
  { id: "progress", label: "By progress" },
];

const pct = (done: number, total: number) => (total ? Math.round((100 * done) / total) : 0);
function overall(k: Kid) {
  return pct((k.math?.passed ?? 0) + k.reading.passed, (k.math?.total ?? 0) + k.reading.total);
}

const Avatar = ({ name }: { name: string }) => (
  <div className="avatar">{name.charAt(0).toUpperCase()}</div>
);

function SubjectButtons({ k }: { k: Kid }) {
  if (!k.placement)
    return (
      <Link href={`/placement/${k.id}`} className="subject-btn math">
        Run placement →
      </Link>
    );
  return (
    <div className="subject-btns">
      {k.yearPlan && (
        <Link href={`/plan/${k.id}`} className="subject-btn plan">
          Year plan
        </Link>
      )}
      <Link href={`/learn/${k.id}`} className="subject-btn math">
        Math →
      </Link>
      <Link href={`/reading/${k.id}`} className="subject-btn reading">
        Reading →
      </Link>
      {(k.grade === 7 || k.grade === 8) && (
        <Link href={`/ai/${k.id}`} className="subject-btn ai">
          AI 7 →
        </Link>
      )}
      <Link href={`/practice/${k.id}/topics`} className="subject-btn topics">
        Topics
      </Link>
    </div>
  );
}

function FullCard({ k }: { k: Kid }) {
  return (
    <div className="child-card">
      <div className="row">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Avatar name={k.name} />
          <div>
            <Link href={`/children/${k.id}`}>
              <strong>{k.name}</strong>
            </Link>{" "}
            <span className="muted">{k.gradeLabel}</span>
            <div className="muted" style={{ fontSize: "0.82rem" }}>
              <span style={{ whiteSpace: "nowrap" }}>
                {k.math ? `Math: ${k.math.passed}/${k.math.total} weeks` : "Math: not placed"}
              </span>
              {" · "}
              <span style={{ whiteSpace: "nowrap" }}>
                Reading: {k.reading.passed}/{k.reading.total} passages
              </span>
              {k.ai7 && k.ai7.total > 0 && (
                <>
                  {" · "}
                  <span style={{ whiteSpace: "nowrap" }}>
                    AI 7: {k.ai7.passed}/{k.ai7.total} lessons
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <SubjectButtons k={k} />
      </div>
      <div className="child-controls">
        <GradeControl studentId={k.id} name={k.name} value={k.grade} options={k.gradeOptions} />
        <ThresholdControl studentId={k.id} value={k.threshold} />
        <div className="card-actions">
          <KidLoginManager studentId={k.id} username={k.username} />
          <Link href={`/children/${k.id}/attempts`} className="card-action">
            Attempts &amp; scores
          </Link>
          <Link href={`/placement/${k.id}`} className="card-action">
            Assess level
          </Link>
          <DeleteChildButton studentId={k.id} name={k.name} />
        </div>
      </div>
    </div>
  );
}

function Tile({ k }: { k: Kid }) {
  const p = overall(k);
  return (
    <div className="kid-tile">
      <div className="kid-tile-head">
        <Avatar name={k.name} />
        <div style={{ minWidth: 0 }}>
          <Link href={`/children/${k.id}`} className="kid-tile-name">
            {k.name}
          </Link>
          <div className="muted" style={{ fontSize: "0.76rem" }}>{k.gradeLabel}</div>
        </div>
        <span className="kid-tile-pct">{p}%</span>
      </div>
      <div className="ladder-bar">
        <div style={{ width: `${p}%` }} />
      </div>
      <div className="kid-tile-stats muted">
        {k.math ? `Math ${k.math.passed}/${k.math.total}` : "Math —"} · Reading {k.reading.passed}/
        {k.reading.total}
        {k.ai7 && k.ai7.total > 0 ? ` · AI7 ${k.ai7.passed}/${k.ai7.total}` : ""}
      </div>
      {k.placement ? (
        <div className="kid-tile-actions">
          <Link href={`/learn/${k.id}`} className="subject-btn math">
            Math
          </Link>
          <Link href={`/reading/${k.id}`} className="subject-btn reading">
            Reading
          </Link>
          {(k.grade === 7 || k.grade === 8) && (
            <Link href={`/ai/${k.id}`} className="subject-btn ai">
              AI 7
            </Link>
          )}
        </div>
      ) : (
        <Link href={`/placement/${k.id}`} className="subject-btn math">
          Run placement
        </Link>
      )}
    </div>
  );
}

function groupByGrade(kids: Kid[]) {
  const m = new Map<number, Kid[]>();
  for (const k of kids) {
    if (!m.has(k.grade)) m.set(k.grade, []);
    m.get(k.grade)!.push(k);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([grade, ks]) => ({ grade, kids: ks }));
}

export function DashboardViews({ kids }: { kids: Kid[] }) {
  const [view, setView] = useState<View>("all");
  if (kids.length === 0)
    return <p className="sub">No children yet. Add one to get started.</p>;

  return (
    <>
      <div className="view-tabs">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            className={"view-tab" + (view === v.id ? " on" : "")}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === "all" && kids.map((k) => <FullCard key={k.id} k={k} />)}

      {view === "grade" &&
        groupByGrade(kids).map((g) => (
          <div key={g.grade} className="view-group">
            <div className="view-group-head">
              Grade {g.grade} · {g.kids.length} {g.kids.length === 1 ? "child" : "children"}
            </div>
            <div className="kid-grid">
              {g.kids.map((k) => (
                <Tile key={k.id} k={k} />
              ))}
            </div>
          </div>
        ))}

      {view === "subject" && (
        <div className="board">
          {(["math", "reading"] as const).map((subj) => (
            <div key={subj} className="board-col">
              <div className="board-col-head">{subj === "math" ? "Math" : "Reading"}</div>
              {kids.map((k) => {
                const s = subj === "math" ? k.math : k.reading;
                const done = s?.passed ?? 0;
                const total = s?.total ?? 0;
                return (
                  <div key={k.id} className="board-row">
                    <Avatar name={k.name} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="kid-tile-name">{k.name}</div>
                      <div className="muted" style={{ fontSize: "0.74rem" }}>
                        {total ? `${done}/${total} · ${pct(done, total)}%` : "—"}
                      </div>
                    </div>
                    {k.placement ? (
                      <Link
                        href={subj === "math" ? `/learn/${k.id}` : `/reading/${k.id}`}
                        className={"subject-btn " + subj}
                      >
                        Open →
                      </Link>
                    ) : (
                      <span className="muted" style={{ fontSize: "0.74rem" }}>
                        placement
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {view === "progress" && (
        <div className="kid-grid">
          {[...kids].sort((a, b) => overall(b) - overall(a)).map((k) => (
            <Tile key={k.id} k={k} />
          ))}
        </div>
      )}
    </>
  );
}
