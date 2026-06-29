"use client";

import { useRef, useState } from "react";
import { Check } from "@/components/icons";
import { RubricForm } from "@/components/capstone/RubricForm";
import type {
  Milestone,
  Artifact,
  KitContent,
  CapstoneRequirement,
  Rubric,
} from "@/lib/capstoneTypes";

// ---------------------------------------------------------------------------
// Sub-component: Project Kit (L8 milestones only)
// ---------------------------------------------------------------------------
// Renders static authored content — instructions, prompt templates, checkpoint
// questions. Explicitly NOT an AI chat interface; design signals this clearly.
// ---------------------------------------------------------------------------
function ProjectKit({ kit }: { kit: KitContent }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  function copyTemplate(text: string, idx: number) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    });
  }

  return (
    <section
      className="cs-kit"
      aria-label="Project Kit"
    >
      <div className="cs-kit-header">
        <span className="badge">Project Kit</span>
        <p className="cs-kit-note">
          Use these with a parent at an AI tool — they are guides, not live AI.
        </p>
      </div>

      {/* Instructions */}
      {kit.instructions && (
        <div className="cs-kit-block">
          <h3 className="cs-kit-section-title">Instructions</h3>
          <p className="cs-kit-instructions">{kit.instructions}</p>
        </div>
      )}

      {/* Prompt Templates */}
      {kit.promptTemplates && kit.promptTemplates.length > 0 && (
        <div className="cs-kit-block">
          <h3 className="cs-kit-section-title">
            Prompt templates
            <span className="cs-kit-section-hint"> — copy and paste into your AI tool</span>
          </h3>
          <ol className="cs-kit-templates" aria-label="Prompt templates to copy">
            {kit.promptTemplates.map((tmpl, idx) => (
              <li key={idx} className="cs-kit-template">
                <pre className="cs-kit-template-text">{tmpl}</pre>
                <button
                  type="button"
                  className="card-action"
                  aria-label={`Copy prompt template ${idx + 1}`}
                  onClick={() => copyTemplate(tmpl, idx)}
                >
                  {copiedIdx === idx ? (
                    <>
                      <Check size={14} /> Copied
                    </>
                  ) : (
                    "Copy"
                  )}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Checkpoint Questions */}
      {kit.checkpointQuestions && kit.checkpointQuestions.length > 0 && (
        <div className="cs-kit-block">
          <h3 className="cs-kit-section-title">Check your work</h3>
          <ul className="cs-kit-checkpoints" aria-label="Checkpoint questions">
            {kit.checkpointQuestions.map((q, idx) => (
              <li key={idx} className="cs-kit-checkpoint">
                {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      <style>{`
        .cs-kit {
          background: var(--sky-soft);
          border: 1.5px solid #bce2f5;
          border-radius: 16px;
          padding: 1rem 1.1rem;
          margin: 1rem 0;
        }
        .cs-kit-header {
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.85rem;
        }
        .cs-kit-note {
          font-size: 0.8rem;
          color: #0369a1;
          font-weight: 600;
          margin: 0;
        }
        .cs-kit-block {
          margin-bottom: 1rem;
        }
        .cs-kit-block:last-child {
          margin-bottom: 0;
        }
        .cs-kit-section-title {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 0.9rem;
          color: var(--ink);
          margin-bottom: 0.45rem;
        }
        .cs-kit-section-hint {
          font-family: var(--font-body);
          font-weight: 600;
          font-size: 0.78rem;
          color: var(--muted);
        }
        .cs-kit-instructions {
          font-size: 0.95rem;
          line-height: 1.65;
          color: #1e3a4a;
          margin: 0;
        }
        .cs-kit-templates {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }
        .cs-kit-template {
          background: #fff;
          border: 1.5px solid #b2d8ef;
          border-radius: 12px;
          padding: 0.75rem 0.9rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .cs-kit-template-text {
          font-family: var(--font-body);
          font-size: 0.9rem;
          line-height: 1.6;
          color: #1e3a4a;
          white-space: pre-wrap;
          word-break: break-word;
          margin: 0;
        }
        .cs-kit-checkpoints {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .cs-kit-checkpoint {
          position: relative;
          padding-left: 1.4rem;
          font-size: 0.92rem;
          color: #1e3a4a;
          line-height: 1.55;
        }
        .cs-kit-checkpoint::before {
          content: "?";
          position: absolute;
          left: 0;
          top: 0;
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 0.85rem;
          color: #0284c7;
        }
      `}</style>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Artifact gallery
// ---------------------------------------------------------------------------
function ArtifactGallery({ artifacts }: { artifacts: Artifact[] }) {
  if (artifacts.length === 0) return null;
  return (
    <ul className="cs-artifact-list" aria-label="Submitted artifacts">
      {artifacts.map((art) => (
        <li key={art.id} className="cs-artifact-item">
          {art.kind === "url" && art.url && (
            /^https?:\/\//i.test(art.url) ? (
              <a
                href={art.url}
                target="_blank"
                rel="noopener noreferrer"
                className="cs-artifact-link"
              >
                {/* Link icon inline SVG */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                {art.url}
              </a>
            ) : (
              <span className="cs-artifact-link">{art.url}</span>
            )
          )}
          {art.kind === "text" && art.bodyText && (
            <blockquote className="cs-artifact-text">
              {art.bodyText.length > 200 ? art.bodyText.slice(0, 200) + "…" : art.bodyText}
            </blockquote>
          )}
          {art.kind === "file" && (
            <>
              {/* Show thumbnail for images; generic chip otherwise */}
              {art.mime?.startsWith("image/") && art.signedUrl ? (
                <img
                  src={art.signedUrl}
                  alt="Submitted artifact"
                  className="cs-artifact-image"
                />
              ) : (
                <span className="cs-artifact-file">
                  {/* File icon */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  {art.mime ?? "File"}
                </span>
              )}
            </>
          )}
        </li>
      ))}

      <style>{`
        .cs-artifact-list {
          list-style: none;
          padding: 0;
          margin: 0.75rem 0 0;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .cs-artifact-item {
          max-width: 100%;
        }
        .cs-artifact-link {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--green-deep);
          background: var(--green-soft);
          border: 1.5px solid #c5e4d8;
          border-radius: 99px;
          padding: 0.3rem 0.7rem;
          text-decoration: none;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cs-artifact-link:hover { background: #d8f0e8; border-color: var(--green); }
        .cs-artifact-text {
          font-size: 0.85rem;
          color: var(--muted);
          border-left: 3px solid var(--line);
          padding-left: 0.65rem;
          margin: 0;
          max-width: 100%;
          word-break: break-word;
        }
        .cs-artifact-file {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--muted);
          background: #f1f3f5;
          border: 1.5px solid var(--line);
          border-radius: 99px;
          padding: 0.3rem 0.7rem;
        }
        .cs-artifact-image {
          display: block;
          max-width: 120px;
          max-height: 90px;
          object-fit: cover;
          border-radius: 10px;
          border: 1.5px solid var(--line);
        }
      `}</style>
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Artifact submission form
// ---------------------------------------------------------------------------
// ArtifactInput is the same shape as MilestonePanelAddInput (defined below),
// but declared here so the sub-component doesn't have a forward-reference dependency.
interface ArtifactInput {
  kind: "url" | "text" | "file";
  value?: string;
  file?: File;
}

interface ArtifactFormProps {
  requirement: CapstoneRequirement;
  onAdd: (input: ArtifactInput) => Promise<void>;
}

function ArtifactForm({ requirement, onAdd }: ArtifactFormProps) {
  const [urlValue, setUrlValue] = useState("");
  const [textValue, setTextValue] = useState("");
  const [urlError, setUrlError] = useState("");
  const [fileError, setFileError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { allowedKinds } = requirement;

  async function handleUrl(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = urlValue.trim();
    if (!trimmed) {
      setUrlError("Enter a URL before adding.");
      return;
    }
    // Simple URL validation — server enforces strictly; this surfaces UX feedback fast.
    if (!/^https?:\/\/.+/.test(trimmed)) {
      setUrlError("Enter a full URL starting with https://");
      return;
    }
    setUrlError("");
    setBusy(true);
    try {
      await onAdd({ kind: "url", value: trimmed });
      setUrlValue("");
    } finally {
      setBusy(false);
    }
  }

  async function handleText(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = textValue.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await onAdd({ kind: "text", value: trimmed });
      setTextValue("");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Client-side size hint only — server enforces strictly.
    if (file.size > 10 * 1024 * 1024) {
      setFileError("File is too large. Maximum size is 10 MB.");
      return;
    }
    setFileError("");
    setBusy(true);
    try {
      await onAdd({ kind: "file", file });
    } finally {
      setBusy(false);
      // Reset the file input so the same file can be re-selected if needed
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="cs-artifact-form">
      {allowedKinds.includes("url") && (
        <form onSubmit={handleUrl} className="cs-artifact-row" noValidate>
          <label htmlFor="cs-url-input" className="cs-input-label">
            Add a link
          </label>
          <div className="cs-artifact-input-row">
            <input
              id="cs-url-input"
              type="url"
              value={urlValue}
              onChange={(e) => {
                setUrlValue(e.target.value);
                if (urlError) setUrlError("");
              }}
              placeholder="https://…"
              className="cs-url-input"
              aria-describedby={urlError ? "cs-url-error" : undefined}
              disabled={busy}
            />
            <button
              type="submit"
              className="card-action"
              disabled={busy || !urlValue.trim()}
              aria-label="Add URL artifact"
            >
              Add
            </button>
          </div>
          {urlError && (
            <p id="cs-url-error" className="err" role="alert">
              {urlError}
            </p>
          )}
        </form>
      )}

      {allowedKinds.includes("text") && (
        <form onSubmit={handleText} className="cs-artifact-row">
          <label htmlFor="cs-text-input" className="cs-input-label">
            Paste text or notes
          </label>
          <textarea
            id="cs-text-input"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="Paste your response, notes, or description here…"
            rows={4}
            className="cs-text-input"
            disabled={busy}
          />
          <button
            type="submit"
            className="card-action"
            disabled={busy || !textValue.trim()}
            style={{ alignSelf: "flex-end", marginTop: "0.35rem" }}
            aria-label="Add text artifact"
          >
            Add text
          </button>
        </form>
      )}

      {allowedKinds.includes("file") && (
        <div className="cs-artifact-row">
          <label htmlFor="cs-file-input" className="cs-input-label">
            Upload a photo or file
          </label>
          <p className="muted" style={{ fontSize: "0.78rem", margin: "0 0 0.35rem" }}>
            Accepted: PNG, JPEG, WebP, PDF. Max 10 MB.
          </p>
          <input
            id="cs-file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            ref={fileRef}
            onChange={handleFile}
            className="cs-file-input"
            disabled={busy}
            aria-describedby={fileError ? "cs-file-error" : undefined}
          />
          {fileError && (
            <p id="cs-file-error" className="err" role="alert">
              {fileError}
            </p>
          )}
        </div>
      )}

      <style>{`
        .cs-artifact-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 0.75rem;
        }
        .cs-artifact-row {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .cs-input-label {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--ink);
          margin: 0;
        }
        .cs-artifact-input-row {
          display: flex;
          gap: 0.5rem;
          align-items: flex-start;
        }
        .cs-url-input {
          flex: 1;
          padding: 0.65rem 0.8rem;
          font-size: 0.95rem;
          border: 1.5px solid var(--line);
          border-radius: 12px;
          font-family: var(--font-body);
          background: #fff;
        }
        .cs-url-input:focus {
          outline: none;
          border-color: var(--green);
          box-shadow: 0 0 0 3px var(--green-soft);
        }
        .cs-text-input {
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
        .cs-text-input:focus {
          outline: none;
          border-color: var(--green);
          box-shadow: 0 0 0 3px var(--green-soft);
        }
        .cs-file-input {
          font-size: 0.88rem;
          color: var(--ink);
          cursor: pointer;
        }
        .cs-file-input:disabled {
          opacity: 0.5;
          cursor: default;
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export interface MilestonePanelAddInput {
  kind: "url" | "text" | "file";
  value?: string;
  file?: File;
}

interface Props {
  milestone: Milestone;
  isParent: boolean;
  onAddArtifact: (input: MilestonePanelAddInput) => Promise<void>;
  onComplete: (rubric?: Rubric) => Promise<void>;
}

export function MilestonePanel({ milestone, isParent, onAddArtifact, onComplete }: Props) {
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");
  // Rubric state for the "reflect" milestone (AC-4.5). Does not block completion.
  const [rubric, setRubric] = useState<Rubric>({ shipped: false, works: false, documented: false });

  const isReflect = milestone.slug === "reflect";

  const isActive = milestone.status === "active";
  const isComplete = milestone.status === "complete";
  const isSubmitted = milestone.status === "submitted";
  const isLocked = milestone.status === "locked";

  const req = milestone.requirement;
  const artifacts = milestone.artifacts ?? [];

  // Determine whether the "Complete" button should be enabled.
  // Mirror the server validation (validateArtifactRequirement) — filter by
  // allowedKinds before counting, so only qualifying artifact types count.
  const meetsRequirement = (() => {
    if (!req.requiresArtifact) return true;
    const qualifying = artifacts.filter((a) => req.allowedKinds.includes(a.kind));
    return qualifying.length >= req.minCount;
  })();

  const canComplete = isActive && meetsRequirement;

  async function handleComplete() {
    if (!canComplete) return;
    setCompleteError("");
    setCompleting(true);
    try {
      // Pass rubric for the reflect milestone; undefined for all others (AC-4.5).
      await onComplete(isReflect ? rubric : undefined);
    } catch {
      setCompleteError("Something went wrong. Please try again.");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <article className="cs-panel" aria-label={`Milestone: ${milestone.title}`}>
      {/* Header */}
      <header className="cs-panel-header">
        <div>
          <h2 className="cs-panel-title">{milestone.title}</h2>
          {(isComplete || isSubmitted) && (
            <span
              className={
                "badge" + (isComplete ? "" : " cs-badge-submitted")
              }
              style={{ marginLeft: "0.5rem" }}
            >
              {isComplete ? "Complete" : "Submitted"}
            </span>
          )}
          {isLocked && (
            <span className="cs-panel-locked-note muted">
              Complete the previous milestone to unlock this one.
            </span>
          )}
        </div>
      </header>

      {/* Locked state: don't render any interactive content */}
      {isLocked ? null : (
        <>
          {/* Project Kit panel (L8 build/ship milestones only) */}
          {milestone.content && <ProjectKit kit={milestone.content} />}

          {/* Already-submitted artifacts */}
          {artifacts.length > 0 && (
            <section aria-label="Your submitted work">
              <h3 className="section-title">Your work</h3>
              <ArtifactGallery artifacts={artifacts} />
            </section>
          )}

          {/* Artifact submission form (only shown when active) */}
          {isActive && req && (
            <section aria-label="Submit your work">
              <h3 className="section-title" style={{ marginTop: "1.25rem" }}>
                Add your work
                {req.requiresArtifact && (
                  <span className="cs-req-note">
                    {" "}— {req.minCount} required to continue
                  </span>
                )}
              </h3>
              <ArtifactForm
                requirement={req}
                onAdd={onAddArtifact}
              />
            </section>
          )}

          {/* Parent-only note nudge (when not active, parents see a summary nudge) */}
          {isParent && !isActive && !isComplete && !isSubmitted && (
            <p className="muted" style={{ marginTop: "0.75rem", fontSize: "0.88rem" }}>
              This milestone is waiting for your child to reach it.
            </p>
          )}

          {/* Self-assessment rubric for the reflect milestone (AC-4.5) */}
          {isActive && isReflect && (
            <RubricForm value={rubric} onChange={setRubric} />
          )}

          {/* Complete milestone action */}
          {isActive && (
            <div style={{ marginTop: "1.25rem" }}>
              {req.requiresArtifact && !meetsRequirement && (
                <p
                  className="cs-complete-hint"
                  role="status"
                  aria-live="polite"
                >
                  {(() => {
                    const qualifyingCount = artifacts.filter((a) =>
                      req.allowedKinds.includes(a.kind),
                    ).length;
                    const remaining = req.minCount - qualifyingCount;
                    return `Add ${remaining} more ${remaining === 1 ? "item" : "items"} to unlock completion.`;
                  })()}
                </p>
              )}
              <button
                type="button"
                className="btn"
                onClick={handleComplete}
                disabled={!canComplete || completing}
                aria-disabled={!canComplete || completing}
                aria-describedby={
                  !meetsRequirement
                    ? "cs-complete-hint"
                    : completeError
                    ? "cs-complete-error"
                    : undefined
                }
              >
                {completing ? "Saving…" : "Complete milestone"}
              </button>
              {completeError && (
                <p id="cs-complete-error" className="err" role="alert">
                  {completeError}
                </p>
              )}
            </div>
          )}
        </>
      )}

      <style>{`
        .cs-panel {
          border: 1.5px solid var(--line);
          border-radius: 18px;
          padding: 1.25rem 1.4rem;
          background: #fff;
          margin-top: 1rem;
        }
        .cs-panel-header {
          margin-bottom: 0.5rem;
        }
        .cs-panel-title {
          display: inline;
          font-family: var(--font-display);
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--ink);
          margin: 0;
        }
        .cs-panel-locked-note {
          display: block;
          margin-top: 0.35rem;
          font-size: 0.88rem;
        }
        .cs-badge-submitted {
          background: var(--amber-soft);
          color: #b45309;
          border: none;
        }
        .cs-req-note {
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--muted);
        }
        .cs-complete-hint {
          font-size: 0.85rem;
          color: #b45309;
          background: var(--amber-soft);
          border-radius: 10px;
          padding: 0.5rem 0.75rem;
          margin-bottom: 0.5rem;
        }
      `}</style>
    </article>
  );
}
