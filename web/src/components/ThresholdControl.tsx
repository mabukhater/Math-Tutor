"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS = [60, 70, 80, 90, 95];

export function ThresholdControl({ studentId, value }: { studentId: string; value: number }) {
  const router = useRouter();
  const [val, setVal] = useState(value);
  const [busy, setBusy] = useState(false);

  async function change(t: number) {
    const prev = val;
    setVal(t); // optimistic
    setBusy(true);
    try {
      const res = await fetch("/api/path/threshold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, threshold: t }),
      });
      if (!res.ok) {
        setVal(prev); // save didn't stick — don't show an unsaved value
        return;
      }
      router.refresh();
    } catch {
      setVal(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="threshold-row" title="Score your child needs to unlock the next week">
      <span>Score to advance</span>
      <select
        value={val}
        disabled={busy}
        onChange={(e) => change(Number(e.target.value))}
        aria-label="Pass mark percentage"
      >
        {OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o}%
          </option>
        ))}
      </select>
    </div>
  );
}
