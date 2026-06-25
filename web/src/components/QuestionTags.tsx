// Small informational chips shown under a question's skill/passage title:
// grade, curriculum, topic, and difficulty. Purely descriptive (not clickable).

export interface Tag {
  label: string;
  kind?: "easy" | "med" | "hard";
}

/** Map a 1–5 difficulty to an Easy/Medium/Hard chip (null if unknown). */
export function difficultyTag(d: number | null | undefined): Tag | null {
  if (d == null) return null;
  if (d <= 2) return { label: "Easy", kind: "easy" };
  if (d === 3) return { label: "Medium", kind: "med" };
  return { label: "Hard", kind: "hard" };
}

export function QuestionTags({ items }: { items: (Tag | null | undefined)[] }) {
  const tags = items.filter((t): t is Tag => !!t && !!t.label);
  if (tags.length === 0) return null;
  return (
    <div className="q-tags">
      {tags.map((t, i) => (
        <span key={i} className={"q-tag" + (t.kind ? " q-tag-" + t.kind : "")}>
          {t.label}
        </span>
      ))}
    </div>
  );
}
