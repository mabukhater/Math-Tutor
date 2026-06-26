"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Lets a parent move a child to a different grade level. Changing the grade
// also repositions the child to the start of that grade's path (handled
// server-side); past progress rows are kept in case they switch back.
export function GradeControl({
  studentId,
  name,
  value,
  options,
}: {
  studentId: string;
  name: string;
  value: number;
  options: { grade: number; label: string }[];
}) {
  const router = useRouter();
  const [val, setVal] = useState(value);
  const [busy, setBusy] = useState(false);

  async function change(g: number) {
    if (g === val) return;
    const label = options.find((o) => o.grade === g)?.label ?? `Grade ${g}`;
    if (
      !confirm(
        `Move ${name} to ${label}?\n\nThis restarts their learning path at the beginning of ${label}. Their past progress is kept if you switch back.`,
      )
    ) {
      return;
    }
    const prev = val;
    setVal(g);
    setBusy(true);
    const res = await fetch("/api/children/grade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, grade: g }),
    });
    setBusy(false);
    if (!res.ok) {
      setVal(prev); // revert the select on failure
      alert("Couldn't change the grade. Please try again.");
      return;
    }
    router.refresh();
  }

  // Only one grade has content for this curriculum — nothing to switch between.
  if (options.length <= 1) return null;

  return (
    <div className="threshold-row" title="Change which grade level this child works at">
      <span>Grade level</span>
      <select
        value={val}
        disabled={busy}
        onChange={(e) => change(Number(e.target.value))}
        aria-label="Grade level"
      >
        {options.map((o) => (
          <option key={o.grade} value={o.grade}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
