/**
 * Adaptive placement engine (M2, Section 5 of the brief).
 *
 * Deterministic — NO LLM. Treats the curriculum's skills as a 1D ladder ordered
 * by `sequence_position` (index 0..N) and binary-searches for the highest rung
 * where the child reliably succeeds. The web app drives it one question at a
 * time: `initPlacement` to start, then `recordAnswer` after each graded answer
 * until `state.done`, at which point `state.estimatedIndex` is where to place
 * the child (`students.current_skill_index`).
 *
 * Pure functions, no I/O — unit-testable in isolation (see placement.test.ts).
 */

export const MAX_STEPS = 10;

/** One rung of the ladder — only ordering + grade matter to the engine. */
export interface LadderSkill {
  index: number; // == sequence_position, contiguous 0..N
  grade: number;
}

export interface PlacementState {
  /** Highest index proven correct so far (lower bound of the answer). */
  low: number;
  /** Lowest index proven too-hard so far (upper bound). */
  high: number;
  /** Max ladder index (N). */
  n: number;
  /** The index whose question should be asked next. */
  estimate: number;
  /** History of asked rungs and outcomes. */
  asked: { index: number; correct: boolean }[];
  done: boolean;
  /** Final placement once `done` — else null. */
  estimatedIndex: number | null;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** First and last ladder index for a grade, or null if the grade is absent. */
export function gradeRange(ladder: LadderSkill[], grade: number): [number, number] | null {
  const idxs = ladder.filter((s) => s.grade === grade).map((s) => s.index);
  if (idxs.length === 0) return null;
  return [Math.min(...idxs), Math.max(...idxs)];
}

/**
 * Start a placement run for a child in `nominalGrade`. Begins mid-difficulty at
 * the first rung of the stated grade; the search window spans from there up
 * through the end of the next grade (so a strong child can be placed ahead).
 */
export function initPlacement(ladder: LadderSkill[], nominalGrade: number): PlacementState {
  if (ladder.length === 0) throw new Error("empty ladder");
  const n = ladder.length - 1;
  const nom = gradeRange(ladder, nominalGrade);
  if (!nom) throw new Error(`grade ${nominalGrade} not in ladder`);
  const [firstNom] = nom;
  const up = gradeRange(ladder, nominalGrade + 1);
  const high = up ? up[1] : nom[1]; // one grade up, or end of this grade if none
  return {
    low: firstNom,
    high,
    n,
    estimate: firstNom,
    asked: [],
    done: false,
    estimatedIndex: null,
  };
}

/**
 * Fold in the result of the question asked at `state.estimate`. Steps the
 * binary search up (correct) or down (wrong); finishes when the window closes
 * (`high - low <= 1`) or after MAX_STEPS. On finish, places at the highest
 * reliably-correct rung, nudged down one if the last two answers were both wrong
 * (guards against a lucky-then-unlucky tail).
 */
export function recordAnswer(state: PlacementState, wasCorrect: boolean): PlacementState {
  if (state.done) return state;
  const asked = [...state.asked, { index: state.estimate, correct: wasCorrect }];
  let { low, high } = state;
  let estimate: number;
  if (wasCorrect) {
    low = state.estimate;
    estimate = Math.round((state.estimate + high) / 2);
  } else {
    high = state.estimate;
    estimate = Math.round((low + state.estimate) / 2);
  }
  estimate = clamp(estimate, 0, state.n);

  const converged = high - low <= 1;
  const reachedMax = asked.length >= MAX_STEPS;
  if (converged || reachedMax) {
    let estimatedIndex = clamp(low, 0, state.n);
    const last2 = asked.slice(-2);
    if (last2.length === 2 && last2.every((a) => !a.correct)) {
      estimatedIndex = clamp(estimatedIndex - 1, 0, state.n);
    }
    return { ...state, low, high, asked, done: true, estimatedIndex };
  }
  return { ...state, low, high, estimate, asked, done: false, estimatedIndex: null };
}
