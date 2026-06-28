"use client";

import type { Rubric } from "@/lib/capstoneTypes";

// ---------------------------------------------------------------------------
// RubricForm
// ---------------------------------------------------------------------------
// Three Yes / No self-assessment toggles for the Reflect milestone.
// Answers are recorded but do not block completion (spec AC-4.5).
// Rendered as a fieldset of toggle-button pairs for keyboard + screen reader
// accessibility. Uses aria-pressed to convey toggle state without relying on
// color alone.
// ---------------------------------------------------------------------------

interface Question {
  key: keyof Rubric;
  label: string;
  description: string;
}

const QUESTIONS: Question[] = [
  {
    key: "shipped",
    label: "Did it ship?",
    description: "Did your project reach the point where someone else could see or use it?",
  },
  {
    key: "works",
    label: "Does it work?",
    description: "Does the main thing you set out to build actually do what you planned?",
  },
  {
    key: "documented",
    label: "Did you document what the AI did?",
    description:
      "Did you note down where you used an AI tool and what it helped you create?",
  },
];

interface Props {
  value: Rubric;
  onChange: (next: Rubric) => void;
}

function Toggle({
  questionKey,
  currentValue,
  onChange,
}: {
  questionKey: keyof Rubric;
  currentValue: boolean | null | undefined;
  onChange: (key: keyof Rubric, val: boolean) => void;
}) {
  const isYes = currentValue === true;
  const isNo = currentValue === false;

  return (
    <div className="cs-rubric-toggle" role="group" aria-labelledby={`cs-rubric-q-${questionKey}`}>
      <button
        type="button"
        className={"cs-rubric-btn cs-rubric-btn--yes" + (isYes ? " cs-rubric-btn--on" : "")}
        aria-pressed={isYes}
        onClick={() => onChange(questionKey, true)}
      >
        Yes
      </button>
      <button
        type="button"
        className={"cs-rubric-btn cs-rubric-btn--no" + (isNo ? " cs-rubric-btn--on-no" : "")}
        aria-pressed={isNo}
        onClick={() => onChange(questionKey, false)}
      >
        No
      </button>
    </div>
  );
}

export function RubricForm({ value, onChange }: Props) {
  function handleChange(key: keyof Rubric, val: boolean) {
    onChange({ ...value, [key]: val });
  }

  return (
    <fieldset className="cs-rubric" aria-label="Self-assessment">
      <legend className="section-title">
        Reflect: self-assessment
        <span className="cs-rubric-note"> — honest answers only, no wrong choice</span>
      </legend>

      <div className="cs-rubric-list">
        {QUESTIONS.map((q) => (
          <div key={q.key} className="cs-rubric-item">
            <div className="cs-rubric-question">
              <p
                id={`cs-rubric-q-${q.key}`}
                className="cs-rubric-label"
              >
                {q.label}
              </p>
              <p className="cs-rubric-desc">{q.description}</p>
            </div>
            <Toggle
              questionKey={q.key}
              currentValue={value[q.key]}
              onChange={handleChange}
            />
          </div>
        ))}
      </div>

      <style>{`
        .cs-rubric {
          border: 1.5px solid var(--line);
          border-radius: 16px;
          padding: 1rem 1.1rem 1.25rem;
          background: var(--green-soft);
          margin: 1rem 0;
        }
        .cs-rubric-note {
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--muted);
        }
        .cs-rubric-list {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          margin-top: 0.75rem;
        }
        .cs-rubric-item {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.75rem 0.9rem;
          background: #fff;
          border: 1.5px solid var(--line);
          border-radius: 12px;
        }
        .cs-rubric-question {
          flex: 1;
          min-width: 0;
        }
        .cs-rubric-label {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--ink);
          margin: 0 0 0.2rem;
        }
        .cs-rubric-desc {
          font-size: 0.82rem;
          color: var(--muted);
          line-height: 1.5;
          margin: 0;
        }
        .cs-rubric-toggle {
          display: flex;
          gap: 0.35rem;
          flex: none;
        }
        .cs-rubric-btn {
          min-width: 48px;
          min-height: 44px; /* WCAG touch target */
          padding: 0.45rem 0.8rem;
          font-family: var(--font-display);
          font-size: 0.92rem;
          font-weight: 700;
          border-radius: 10px;
          border: 2px solid var(--line);
          background: #fff;
          cursor: pointer;
          color: var(--muted);
          transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
          line-height: 1;
        }
        .cs-rubric-btn:focus-visible {
          outline: 3px solid var(--sky);
          outline-offset: 2px;
        }
        .cs-rubric-btn--yes.cs-rubric-btn--on {
          background: var(--green);
          border-color: var(--green);
          color: #fff;
          box-shadow: 0 2px 0 var(--green-deep);
        }
        .cs-rubric-btn--no.cs-rubric-btn--on-no {
          background: #e2574c;
          border-color: #e2574c;
          color: #fff;
          box-shadow: 0 2px 0 #b03428;
        }
        .cs-rubric-btn:hover:not(.cs-rubric-btn--on):not(.cs-rubric-btn--on-no) {
          border-color: var(--green);
          background: var(--green-soft);
          color: var(--green-deep);
        }

        @media (max-width: 420px) {
          .cs-rubric-item {
            flex-direction: column;
          }
          .cs-rubric-toggle {
            width: 100%;
          }
          .cs-rubric-btn {
            flex: 1;
            text-align: center;
          }
        }
      `}</style>
    </fieldset>
  );
}
