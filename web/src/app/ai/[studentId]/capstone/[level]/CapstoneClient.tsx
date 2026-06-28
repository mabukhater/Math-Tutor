"use client";

// Capstone client — fetches capstone state from /api/capstone and renders the
// designer's components. Uses client-side fetch so async callback props
// (onAddArtifact, onComplete, onAttest) can be plain async functions, which is
// the correct pattern in Next.js App Router for client components.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MilestoneStepper } from "@/components/capstone/MilestoneStepper";
import { MilestonePanel } from "@/components/capstone/MilestonePanel";
import { ParentAttestPanel } from "@/components/capstone/ParentAttestPanel";
import type { Milestone, Attestation } from "@/lib/capstoneTypes";

interface CapstoneState {
  capstone: { id: string; level: string; completedAt: string | null };
  milestones: Milestone[];
  canAttest: boolean;
  isParent: boolean;
  attestation: Attestation;
}

export default function CapstoneClient({
  studentId,
  levelNum,
}: {
  studentId: string;
  levelNum: 7 | 8;
}) {
  const [state, setState] = useState<CapstoneState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/capstone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, level: levelNum }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({})) as { prereqMessage?: string };
      setLoadError(d.prereqMessage ?? "Could not load capstone.");
      return;
    }
    const d = await r.json() as CapstoneState;
    setState(d);
  }, [studentId, levelNum]);

  useEffect(() => {
    load();
  }, [load]);

  const addArtifact = useCallback(
    async (input: { kind: "url" | "text" | "file"; value?: string; file?: File }) => {
      if (!state) return;
      const activeMilestone = state.milestones.find((m) => m.status === "active");
      if (!activeMilestone) return;

      if (input.kind === "file" && input.file) {
        const form = new FormData();
        form.set("studentId", studentId);
        form.set("level", String(levelNum));
        form.set("slug", activeMilestone.slug);
        form.set("file", input.file);
        const r = await fetch("/api/capstone/artifact", { method: "POST", body: form });
        if (!r.ok) {
          const d = await r.json().catch(() => ({})) as { error?: string };
          throw new Error(d.error ?? "upload failed");
        }
      } else {
        const r = await fetch("/api/capstone/artifact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            level: levelNum,
            slug: activeMilestone.slug,
            kind: input.kind,
            value: input.value,
          }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({})) as { error?: string };
          throw new Error(d.error ?? "save failed");
        }
      }
      await load();
    },
    [state, studentId, levelNum, load],
  );

  const complete = useCallback(async () => {
    if (!state) return;
    const activeMilestone = state.milestones.find((m) => m.status === "active");
    if (!activeMilestone) return;
    const r = await fetch("/api/capstone/milestone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, level: levelNum, slug: activeMilestone.slug }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({})) as { error?: string };
      throw new Error(d.error ?? "submit failed");
    }
    await load();
  }, [state, studentId, levelNum, load]);

  const attest = useCallback(
    async (note?: string) => {
      const r = await fetch("/api/capstone/attest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, level: levelNum, note }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "attest failed");
      }
      await load();
    },
    [studentId, levelNum, load],
  );

  const backHref = levelNum === 8 ? `/ai/${studentId}/ai8` : `/ai/${studentId}`;

  if (loadError) {
    return (
      <div className="wrap">
        <div className="card" style={{ maxWidth: 720 }}>
          <h1>Level {levelNum} Capstone</h1>
          <p className="sub">{loadError}</p>
          <Link href={backHref} className="btn">
            Back to AI {levelNum}
          </Link>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="wrap">
        <div className="card" style={{ maxWidth: 720 }}>
          <p className="muted">Loading…</p>
        </div>
      </div>
    );
  }

  const activeMilestone = state.milestones.find((m) => m.status === "active") ?? null;

  return (
    <div className="wrap">
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="row" style={{ marginBottom: "0.5rem" }}>
          <h1 style={{ margin: 0 }}>Level {levelNum} Capstone</h1>
          <Link href={backHref} className="muted home-link">
            Back to AI {levelNum}
          </Link>
        </div>
        <p className="sub">
          {levelNum === 7
            ? "Complete 6 milestones to finish your AI-free capstone project."
            : "Complete 6 milestones to ship your AI-assisted capstone project."}
        </p>

        {state.capstone.completedAt && (
          <div
            className="ladder-head clay"
            style={{ background: "var(--amber-10, #fff8e1)", marginBottom: "1rem" }}
          >
            <p style={{ margin: 0, fontWeight: 700 }}>
              Capstone complete! Completed{" "}
              {new Date(state.capstone.completedAt).toLocaleDateString()}
            </p>
            <Link
              href={`/children/${studentId}/portfolio`}
              className="btn"
              style={{ marginTop: "0.75rem" }}
            >
              View portfolio
            </Link>
          </div>
        )}

        {/* Designer component: milestone stepper (AC-4.1, AC-4.3) */}
        <MilestoneStepper milestones={state.milestones} />

        {/* Active milestone panel */}
        {activeMilestone && (
          <MilestonePanel
            milestone={activeMilestone}
            isParent={state.isParent}
            onAddArtifact={addArtifact}
            onComplete={complete}
          />
        )}

        {/* Parent attestation panel — AC-6.1: visible to parent only when all complete */}
        <ParentAttestPanel
          canAttest={state.canAttest}
          isParent={state.isParent}
          onAttest={attest}
        />
      </div>
    </div>
  );
}
