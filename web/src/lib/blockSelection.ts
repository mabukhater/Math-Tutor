// Pure block composition for a fresh math attempt.
//
// After a failed block the child must retry, but the quiz should not be
// identical. We pick up to `blockSize` questions, preferring ones NOT in the
// previous block so a retry brings new material (>= half new whenever the bank
// has at least `blockSize/2` questions outside the previous block), then fill
// any remaining slots with the least-recently-seen repeats. Finally we order
// easiest-first to ramp the child up. Falls back gracefully on thin banks
// (never throws, never returns more than `blockSize`).

export interface VettedQuestion {
  id: string;
  difficulty: number;
}

export function composeBlock(
  vetted: VettedQuestion[],
  previousIds: Set<string>,
  lastSeen: Map<string, number>,
  blockSize: number,
  rand: () => number = Math.random,
): string[] {
  const byLeastSeen = (a: VettedQuestion, b: VettedQuestion) =>
    (lastSeen.get(a.id) ?? 0) - (lastSeen.get(b.id) ?? 0) || rand() - 0.5;

  const fresh = vetted.filter((q) => !previousIds.has(q.id)).sort(byLeastSeen);
  const repeats = vetted.filter((q) => previousIds.has(q.id)).sort(byLeastSeen);

  const chosen = fresh.slice(0, blockSize);
  if (chosen.length < blockSize) {
    chosen.push(...repeats.slice(0, blockSize - chosen.length));
  }

  return chosen
    .sort((a, b) => (a.difficulty ?? 3) - (b.difficulty ?? 3))
    .map((q) => q.id);
}
