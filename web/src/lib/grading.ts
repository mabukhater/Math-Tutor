// Small, pure helpers shared by every answer route. Extracted because the
// response-time clamp and the multiple-choice feedback builder were copy-pasted
// verbatim across practice/answer, practice/topic/answer, path/answer, and
// placement/answer — and had already started to drift. The session/block advance
// logic stays per-route (daily vs topic vs path vs reading are genuinely
// different flows); only the truly-common bits live here.

/** Normalize a client-reported answer time to a sane millisecond value, or null.
 * Guards against non-numbers, negatives, and absurd values (caps at 1 hour). */
export function clampResponseTime(responseTimeMs: unknown): number | null {
  return typeof responseTimeMs === "number" && isFinite(responseTimeMs) && responseTimeMs >= 0
    ? Math.min(Math.round(responseTimeMs), 3_600_000)
    : null;
}

export interface McqFeedback {
  correct: boolean;
  correctIndex: number;
  /** Per-option explanation for the WRONG choice (null when correct or absent). */
  whyWrong: string | null;
  /** Explanation for the correct option, falling back to the single explanation. */
  correctExplanation: string;
}

/** Grade one multiple-choice answer against a question row and build the
 * kid-friendly feedback. Shared by the math answer routes (questions table). */
export function gradeMcqAnswer(
  q: { correct_index: number; explanation: string; option_explanations?: string[] | null },
  selectedIndex: number,
): McqFeedback {
  const correctIndex = q.correct_index;
  const correct = selectedIndex === correctIndex;
  const oe = q.option_explanations ?? null;
  return {
    correct,
    correctIndex,
    whyWrong: !correct ? (oe?.[selectedIndex] ?? null) : null,
    correctExplanation: oe?.[correctIndex] ?? q.explanation,
  };
}
