"use client";

import { Check, Lock } from "@/components/icons";
import type { Milestone, MilestoneStatus } from "@/lib/capstoneTypes";

// -----------------------------------------------------------------------
// Label copy for the 6 fixed milestone slugs.
// Falls back to milestone.title if the slug doesn't match (future-proofing).
// -----------------------------------------------------------------------
const SLUG_LABELS: Record<string, string> = {
  idea: "Idea",
  plan: "Plan",
  build_v1: "Build v1",
  test_feedback: "Test & Feedback",
  ship: "Ship",
  reflect: "Reflect",
};

interface Props {
  milestones: Milestone[];
}

// -----------------------------------------------------------------------
// Status helpers
// -----------------------------------------------------------------------
function statusLabel(status: MilestoneStatus): string {
  switch (status) {
    case "locked": return "Locked";
    case "active": return "In progress";
    case "submitted": return "Submitted";
    case "complete": return "Complete";
  }
}

function StepNode({ status, position }: { status: MilestoneStatus; position: number }) {
  const isComplete = status === "complete";
  const isSubmitted = status === "submitted";
  const isActive = status === "active";
  const isLocked = status === "locked";

  let nodeClass = "cs-step-node";
  if (isComplete) nodeClass += " cs-step-node--complete";
  else if (isSubmitted) nodeClass += " cs-step-node--submitted";
  else if (isActive) nodeClass += " cs-step-node--active";
  else if (isLocked) nodeClass += " cs-step-node--locked";

  return (
    <div className={nodeClass} aria-hidden="true">
      {isComplete ? (
        <Check size={18} />
      ) : isSubmitted ? (
        // Outline check: partially complete — submitted but not attested
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : isLocked ? (
        <Lock size={16} />
      ) : (
        <span>{position}</span>
      )}
    </div>
  );
}

export function MilestoneStepper({ milestones }: Props) {
  if (!milestones || milestones.length === 0) {
    return (
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        No milestones loaded yet.
      </p>
    );
  }

  // Sort by position to be defensive about prop ordering
  const sorted = [...milestones].sort((a, b) => a.position - b.position);
  const activeIndex = sorted.findIndex((m) => m.status === "active");

  return (
    <nav aria-label="Capstone milestones" className="cs-stepper">
      <ol
        className="cs-stepper-list"
        style={{ listStyle: "none", padding: 0, margin: 0 }}
      >
        {sorted.map((milestone, idx) => {
          const label = SLUG_LABELS[milestone.slug] ?? milestone.title;
          const isCurrent = milestone.status === "active";
          const isLocked = milestone.status === "locked";
          const isComplete = milestone.status === "complete";
          const isSubmitted = milestone.status === "submitted";
          const isLast = idx === sorted.length - 1;

          return (
            <li
              key={milestone.id}
              className={
                "cs-stepper-item" +
                (isCurrent ? " cs-stepper-item--active" : "") +
                (isComplete ? " cs-stepper-item--complete" : "") +
                (isSubmitted ? " cs-stepper-item--submitted" : "") +
                (isLocked ? " cs-stepper-item--locked" : "")
              }
              // aria-current identifies the active step for AT without relying on color alone
              aria-current={isCurrent ? "step" : undefined}
              // aria-disabled for locked steps so screen readers announce them clearly
              aria-disabled={isLocked ? "true" : undefined}
            >
              <div className="cs-stepper-track">
                <StepNode status={milestone.status} position={milestone.position} />
                {/* Vertical connector line between steps */}
                {!isLast && (
                  <div
                    className={
                      "cs-stepper-line" +
                      (isComplete ? " cs-stepper-line--done" : "")
                    }
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className="cs-stepper-body">
                <span className="cs-stepper-label">
                  {label}
                </span>
                <span
                  className={
                    "cs-stepper-status" +
                    (isComplete ? " cs-stepper-status--complete" : "") +
                    (isCurrent ? " cs-stepper-status--active" : "") +
                    (isLocked ? " cs-stepper-status--locked" : "")
                  }
                >
                  {statusLabel(milestone.status)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Inline styles scoped to this component — matches the app's globals.css conventions */}
      <style>{`
        .cs-stepper {
          margin: 1rem 0;
        }
        .cs-stepper-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        /* ---- Horizontal on wider viewports ---- */
        @media (min-width: 560px) {
          .cs-stepper-list {
            flex-direction: row;
            align-items: flex-start;
            gap: 0;
          }
          .cs-stepper-item {
            flex: 1;
          }
          .cs-stepper-track {
            flex-direction: row !important;
            align-items: center;
            justify-content: center;
          }
          .cs-stepper-line {
            flex: 1;
            height: 4px !important;
            width: auto !important;
            min-width: 12px;
            margin: 0 !important;
          }
          .cs-stepper-body {
            margin-left: 0 !important;
            margin-top: 0.45rem !important;
            text-align: center;
          }
        }

        .cs-stepper-item {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          position: relative;
        }

        /* Vertical layout (mobile) */
        .cs-stepper-track {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 40px;
          flex: none;
        }

        .cs-stepper-node {
          width: 40px;
          height: 40px;
          flex: none;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 1rem;
          border: 3px solid #e5e7eb;
          background: #f4f4f4;
          color: #9ca3af;
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .cs-step-node {
          width: 40px;
          height: 40px;
          flex: none;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 1rem;
          border: 3px solid #e5e7eb;
          background: #f4f4f4;
          color: #9ca3af;
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
        }
        .cs-step-node--active {
          background: #fff;
          border-color: var(--amber);
          color: var(--amber);
          box-shadow: 0 0 0 4px rgba(244,162,58,0.15);
          animation: cs-pulse 1.6s ease-in-out infinite;
        }
        .cs-step-node--submitted {
          background: var(--green-soft);
          border-color: var(--green);
          color: var(--green-deep);
        }
        .cs-step-node--complete {
          background: var(--green);
          border-color: var(--green);
          color: #fff;
          box-shadow: 0 3px 0 var(--green-deep);
        }
        .cs-step-node--locked {
          background: #f4f4f4;
          border-color: #e5e7eb;
          color: #9ca3af;
        }

        @keyframes cs-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(244,162,58,0.4); }
          50%       { box-shadow: 0 0 0 10px rgba(244,162,58,0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cs-step-node--active { animation: none; }
        }

        .cs-stepper-line {
          width: 4px;
          flex: 1;
          min-height: 20px;
          background: #e5e7eb;
          border-radius: 99px;
          margin: 2px 0;
          transition: background 0.2s ease;
        }
        .cs-stepper-line--done {
          background: var(--green);
        }

        .cs-stepper-body {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
          padding: 0.1rem 0 0.9rem 0.75rem;
          margin-left: 0;
        }

        .cs-stepper-label {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--ink);
          line-height: 1.25;
        }
        .cs-stepper-item--locked .cs-stepper-label {
          color: #9ca3af;
        }

        .cs-stepper-status {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--muted);
        }
        .cs-stepper-status--active {
          color: #b45309;
        }
        .cs-stepper-status--complete {
          color: var(--green-deep);
        }
        .cs-stepper-status--locked {
          color: #c4ccc8;
        }
      `}</style>
    </nav>
  );
}
