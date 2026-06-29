"use client";

import { useState } from "react";
import { Check } from "@/components/icons";

// ---------------------------------------------------------------------------
// ParentAttestPanel
// ---------------------------------------------------------------------------
// Handles four states cleanly:
//   1. Kid view (!isParent)           — calm informational message, no button
//   2. Parent, not ready (!canAttest) — explains what is still incomplete
//   3. Parent, ready (canAttest)      — optional note + "Attest & Complete" CTA
//   4. After attestation              — success confirmation
//
// The endpoint itself enforces role=parent; this component only shapes the UI.
// ---------------------------------------------------------------------------

interface Props {
  canAttest: boolean;
  isParent: boolean;
  onAttest: (note?: string) => Promise<void>;
}

export function ParentAttestPanel({ canAttest, isParent, onAttest }: Props) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // --- 4. Post-attestation confirmation ---
  if (done) {
    return (
      <div className="cs-attest cs-attest--done" role="status" aria-live="polite">
        <div className="cs-attest-icon cs-attest-icon--done" aria-hidden="true">
          <Check size={22} />
        </div>
        <div>
          <p className="cs-attest-done-title">Signed off — capstone complete!</p>
          <p className="cs-attest-done-sub">
            This capstone is now marked complete. Well done to your child!
          </p>
        </div>

        <style>{`
          .cs-attest--done {
            display: flex;
            align-items: flex-start;
            gap: 0.85rem;
            background: var(--green-soft);
            border: 1.5px solid #c5e4d8;
            border-radius: 16px;
            padding: 1rem 1.15rem;
            margin-top: 1rem;
          }
          .cs-attest-icon--done {
            width: 40px;
            height: 40px;
            flex: none;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--green);
            color: #fff;
          }
          .cs-attest-done-title {
            font-family: var(--font-display);
            font-weight: 700;
            font-size: 1rem;
            color: var(--green-deep);
            margin: 0 0 0.2rem;
          }
          .cs-attest-done-sub {
            font-size: 0.88rem;
            color: var(--green-deep);
            margin: 0;
          }
        `}</style>
      </div>
    );
  }

  // --- 1. Kid view ---
  if (!isParent) {
    return (
      <aside
        className="cs-attest cs-attest--kid"
        aria-label="Parent sign-off required"
      >
        <p className="cs-attest-kid-msg">
          Ask a parent to review your work and sign off to finish the capstone.
        </p>

        <style>{`
          .cs-attest--kid {
            background: var(--amber-soft);
            border: 1.5px solid #ffd98a;
            border-radius: 14px;
            padding: 0.85rem 1rem;
            margin-top: 1rem;
          }
          .cs-attest-kid-msg {
            font-size: 0.92rem;
            font-weight: 600;
            color: #8a5a00;
            margin: 0;
          }
        `}</style>
      </aside>
    );
  }

  // --- 2. Parent, not yet ready ---
  if (!canAttest) {
    return (
      <aside
        className="cs-attest cs-attest--waiting"
        aria-label="Capstone not yet ready for sign-off"
      >
        <p className="cs-attest-waiting-title">Not ready for sign-off yet</p>
        <p className="cs-attest-waiting-msg">
          All six milestones must be submitted with their required artifacts before you
          can attest. Check which milestone is still active above and help your child
          complete it.
        </p>

        <style>{`
          .cs-attest--waiting {
            background: #f1f3f5;
            border: 1.5px solid var(--line);
            border-radius: 14px;
            padding: 0.9rem 1rem;
            margin-top: 1rem;
          }
          .cs-attest-waiting-title {
            font-family: var(--font-display);
            font-weight: 700;
            font-size: 0.95rem;
            color: var(--ink);
            margin: 0 0 0.3rem;
          }
          .cs-attest-waiting-msg {
            font-size: 0.88rem;
            color: var(--muted);
            line-height: 1.55;
            margin: 0;
          }
        `}</style>
      </aside>
    );
  }

  // --- 3. Parent, ready to attest ---
  async function handleAttest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onAttest(note.trim() || undefined);
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside
      className="cs-attest cs-attest--ready"
      aria-label="Parent sign-off"
    >
      <p className="cs-attest-ready-title">Ready for parent sign-off</p>
      <p className="cs-attest-ready-desc">
        Review your child&apos;s work above. When you&apos;re satisfied, add an optional
        note and tap &quot;Attest &amp; Complete&quot; to formally mark this capstone done.
        This action cannot be undone.
      </p>

      <form onSubmit={handleAttest} className="cs-attest-form" noValidate>
        <label htmlFor="cs-attest-note" className="cs-attest-label">
          Add a note for your child (optional)
        </label>
        <textarea
          id="cs-attest-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Great work on your project — I loved seeing…"
          rows={3}
          className="cs-attest-textarea"
          disabled={busy}
          maxLength={500}
          aria-describedby="cs-attest-char-hint"
        />
        <p
          id="cs-attest-char-hint"
          className="muted"
          style={{ fontSize: "0.75rem", textAlign: "right", margin: "0.2rem 0 0" }}
        >
          {note.length}/500
        </p>

        {error && (
          <p className="err" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn"
          disabled={busy}
          aria-disabled={busy}
          style={{ marginTop: "0.85rem" }}
        >
          {busy ? "Saving…" : "Attest & Complete"}
        </button>
      </form>

      <style>{`
        .cs-attest--ready {
          background: #fff;
          border: 2px solid var(--green);
          border-radius: 18px;
          padding: 1.1rem 1.25rem;
          margin-top: 1rem;
          box-shadow: 0 4px 0 #cfe9df;
        }
        .cs-attest-ready-title {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 1.05rem;
          color: var(--green-deep);
          margin: 0 0 0.3rem;
        }
        .cs-attest-ready-desc {
          font-size: 0.88rem;
          color: var(--muted);
          line-height: 1.55;
          margin: 0 0 0.9rem;
        }
        .cs-attest-form {
          display: flex;
          flex-direction: column;
        }
        .cs-attest-label {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--ink);
          margin: 0 0 0.3rem;
        }
        .cs-attest-textarea {
          width: 100%;
          padding: 0.7rem 0.85rem;
          font-size: 0.95rem;
          font-family: var(--font-body);
          border: 1.5px solid var(--line);
          border-radius: 12px;
          background: #fff;
          resize: vertical;
          line-height: 1.55;
        }
        .cs-attest-textarea:focus {
          outline: none;
          border-color: var(--green);
          box-shadow: 0 0 0 3px var(--green-soft);
        }
        .cs-attest-textarea:disabled {
          background: #f6f6f4;
          color: var(--muted);
        }
      `}</style>
    </aside>
  );
}
