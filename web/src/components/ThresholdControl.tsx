"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS = [60, 70, 80, 90, 95];

export function ThresholdControl({ studentId, value }: { studentId: string; value: number }) {
  const router = useRouter();
  const [val, setVal] = useState(value);
  const [busy, setBusy] = useState(false);

  async function change(t: number) {
    setVal(t);
    setBusy(true);
    await fetch("/api/path/threshold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, threshold: t }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="threshold-row">
      <span className="muted">Pass mark (parent)</span>
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
