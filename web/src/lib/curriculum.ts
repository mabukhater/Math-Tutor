/** Render an internal level integer (1–8) with a curriculum's own label. */
export function gradeLabel(
  noun: string | null | undefined,
  offset: number | null | undefined,
  grade: number,
  code?: string | null,
): string {
  // Singapore switches from Primary (1–6) to Secondary (1–2) at internal grade 7.
  if (code === "singapore" && grade >= 7) return `Secondary ${grade - 6}`;
  return `${noun ?? "Grade"} ${grade + (offset ?? 0)}`;
}

export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8];
