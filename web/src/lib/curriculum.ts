/** Render an internal level integer (3/4/5) with a curriculum's own label. */
export function gradeLabel(
  noun: string | null | undefined,
  offset: number | null | undefined,
  grade: number,
): string {
  return `${noun ?? "Grade"} ${grade + (offset ?? 0)}`;
}
