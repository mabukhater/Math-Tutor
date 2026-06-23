"use client";

import { useState } from "react";

export function DeleteChildButton({ studentId, name }: { studentId: string; name: string }) {
  const [busy, setBusy] = useState(false);

  async function del() {
    if (
      !window.confirm(
        `Delete ${name}’s account and all their progress? This can’t be undone.`,
      )
    )
      return;
    setBusy(true);
    try {
      const r = await fetch(`/api/children/${studentId}`, { method: "DELETE" });
      if (r.ok) {
        window.location.reload();
        return;
      }
      alert("Couldn’t delete. Please try again.");
    } catch {
      alert("Couldn’t delete. Please try again.");
    }
    setBusy(false);
  }

  return (
    <button onClick={del} disabled={busy} className="delete-child">
      {busy ? "Deleting…" : "Delete child"}
    </button>
  );
}
