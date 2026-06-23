"use client";

import { Check, Cross } from "@/components/icons";

/**
 * A strip of numbered chips, one per question in the block. Answered questions
 * are colored by result (and carry a check/cross badge so result is not conveyed
 * by color alone); the in-progress question is highlighted; future questions are
 * dimmed. Clicking any answered chip (or the current one) jumps there.
 */
export function QuestionNav({
  total,
  results,
  liveIndex,
  viewIndex,
  onJump,
}: {
  total: number;
  results: boolean[]; // results[i] is set for each answered question, in order
  liveIndex: number; // index of the live, in-progress question (-1 when finished)
  viewIndex: number; // index currently on screen, gets the focus ring (-1 for none)
  onJump: (i: number) => void;
}) {
  return (
    <div className="qnav" role="list" aria-label="Questions in this set">
      {Array.from({ length: total }, (_, i) => {
        const answered = i < results.length;
        const status = answered
          ? results[i]
            ? "correct"
            : "wrong"
          : i === liveIndex
            ? "current"
            : "upcoming";
        const clickable = answered || i === liveIndex;
        const label = `Question ${i + 1}${
          answered
            ? results[i]
              ? ", correct"
              : ", incorrect"
            : i === liveIndex
              ? ", current"
              : ", not answered yet"
        }`;
        return (
          <button
            key={i}
            role="listitem"
            type="button"
            className={`qnav-cell ${status}${i === viewIndex ? " view" : ""}`}
            disabled={!clickable}
            aria-label={label}
            aria-current={i === viewIndex ? "true" : undefined}
            onClick={() => clickable && onJump(i)}
          >
            <span className="qnav-num">{i + 1}</span>
            {answered && (
              <span className="qnav-badge" aria-hidden="true">
                {results[i] ? <Check size={11} /> : <Cross size={11} />}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
