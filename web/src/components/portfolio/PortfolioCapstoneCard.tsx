// Server component — no "use client" needed.
// All data is passed in via props; no data fetching here.

import { Check } from "@/components/icons";
import type { Milestone, Attestation, Rubric } from "@/lib/capstoneTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
// CapstoneLevel comes from @/lib/capstoneTypes; re-used here as a prop shape.
interface Props {
  capstone: {
    level: number; // 7 or 8
    completedAt: string; // ISO 8601 date string
  };
  milestones: Milestone[];
  attestation: Attestation;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const SLUG_LABELS: Record<string, string> = {
  idea: "Idea",
  plan: "Plan",
  build_v1: "Build v1",
  test_feedback: "Test & Feedback",
  ship: "Ship",
  reflect: "Reflect",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Rubric summary
// ---------------------------------------------------------------------------
function RubricSummary({ rubric }: { rubric: Rubric }) {
  const ITEMS: { key: keyof Rubric; label: string }[] = [
    { key: "shipped", label: "Shipped" },
    { key: "works", label: "Works" },
    { key: "documented", label: "AI documented" },
  ];
  return (
    <div className="cs-port-rubric" aria-label="Self-assessment answers">
      {ITEMS.map(({ key, label }) => {
        const val = rubric[key];
        const answered = val !== null && val !== undefined;
        return (
          <div
            key={key}
            className={
              "cs-port-rubric-item" +
              (val === true
                ? " cs-port-rubric-item--yes"
                : val === false
                ? " cs-port-rubric-item--no"
                : "")
            }
          >
            <span className="cs-port-rubric-label">{label}</span>
            <span className="cs-port-rubric-val">
              {!answered ? "—" : val ? "Yes" : "No"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Artifact gallery (portfolio-display only, no upload)
// ---------------------------------------------------------------------------
function ArtifactGallery({ milestones }: { milestones: Milestone[] }) {
  // Collect all artifacts across milestones that have them
  const allArtifacts = milestones.flatMap((m) =>
    (m.artifacts ?? []).map((art) => ({ ...art, milestoneTitle: SLUG_LABELS[m.slug] ?? m.title }))
  );

  if (allArtifacts.length === 0) {
    return <p className="muted" style={{ fontSize: "0.85rem" }}>No artifacts submitted.</p>;
  }

  return (
    <ul className="cs-port-artifacts" aria-label="Project artifacts">
      {allArtifacts.map((art) => (
        <li key={art.id} className="cs-port-artifact">
          {art.kind === "url" && art.url && (
            <a
              href={art.url}
              target="_blank"
              rel="noopener noreferrer"
              className="cs-port-artifact-link"
              aria-label={`${art.milestoneTitle}: open project link`}
            >
              {/* Link icon */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              {art.milestoneTitle}
            </a>
          )}

          {art.kind === "text" && art.bodyText && (
            <div className="cs-port-artifact-text">
              <span className="cs-port-artifact-source">{art.milestoneTitle}</span>
              <blockquote className="cs-port-artifact-quote">
                {art.bodyText.length > 160
                  ? art.bodyText.slice(0, 160) + "…"
                  : art.bodyText}
              </blockquote>
            </div>
          )}

          {art.kind === "file" && (
            <>
              {art.mime?.startsWith("image/") && art.signedUrl ? (
                <figure className="cs-port-artifact-fig">
                  <img
                    src={art.signedUrl}
                    alt={`${art.milestoneTitle} — submitted screenshot`}
                    className="cs-port-artifact-img"
                  />
                  <figcaption className="cs-port-artifact-source">
                    {art.milestoneTitle}
                  </figcaption>
                </figure>
              ) : (
                <div className="cs-port-artifact-file">
                  {/* File icon */}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>{art.milestoneTitle}</span>
                </div>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function PortfolioCapstoneCard({ capstone, milestones, attestation }: Props) {
  const sorted = [...milestones].sort((a, b) => a.position - b.position);

  // Find the rubric — it lives on the "reflect" milestone.
  // NOTE: Milestone type from capstoneTypes.ts does not currently include a `rubric` field.
  // The engineer must extend Milestone (or create a MilestoneWithRubric type) to include
  //   rubric?: Rubric | null
  // This cast will resolve once that is in place. Flag to orchestrator: prop-shape mismatch risk.
  const reflectMilestone = sorted.find((m) => m.slug === "reflect");
  const rubric = reflectMilestone?.status === "complete"
    ? ((reflectMilestone as Milestone & { rubric?: Rubric | null }).rubric ?? null)
    : null;

  const levelLabel = `AI ${capstone.level}: ${capstone.level === 7 ? "Foundations" : "Builds On"}`;

  return (
    <article
      className="cs-port-card"
      aria-label={`${levelLabel} capstone`}
    >
      {/* Privacy notice — family-visible only */}
      <p className="cs-port-private" role="note">
        This portfolio is private to your family.
      </p>

      {/* Card header */}
      <header className="cs-port-header">
        <div className="cs-port-level-badge" aria-label={`Level ${capstone.level} capstone`}>
          L{capstone.level}
        </div>
        <div>
          <h2 className="cs-port-title">{levelLabel} Capstone</h2>
          <p className="cs-port-date muted">
            Completed on {formatDate(capstone.completedAt)}
          </p>
        </div>
        <div className="cs-port-complete-chip" aria-label="Complete">
          <Check size={16} />
          Complete
        </div>
      </header>

      {/* Milestone summary strip */}
      <section aria-label="Milestone summary">
        <h3 className="section-title">Milestones</h3>
        <ol className="cs-port-milestones" aria-label="Completed milestones">
          {sorted.map((m) => (
            <li
              key={m.id}
              className={
                "cs-port-milestone" +
                (m.status === "complete" ? " cs-port-milestone--done" : "")
              }
            >
              <span className="cs-port-milestone-icon" aria-hidden="true">
                {m.status === "complete" ? <Check size={14} /> : <span>·</span>}
              </span>
              <span>{SLUG_LABELS[m.slug] ?? m.title}</span>
              {m.submittedAt && (
                <span className="cs-port-milestone-date">
                  {formatDate(m.submittedAt)}
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* Artifact gallery */}
      <section aria-label="Project artifacts" style={{ marginTop: "1.25rem" }}>
        <h3 className="section-title">Artifacts</h3>
        <ArtifactGallery milestones={sorted} />
      </section>

      {/* Rubric answers (Reflect milestone) */}
      {rubric && (
        <section aria-label="Self-assessment" style={{ marginTop: "1.25rem" }}>
          <h3 className="section-title">Self-assessment</h3>
          <RubricSummary rubric={rubric} />
        </section>
      )}

      {/* Parent attestation */}
      {attestation && (
        <section
          className="cs-port-attest"
          aria-label="Parent attestation"
        >
          <div className="cs-port-attest-icon" aria-hidden="true">
            <Check size={16} />
          </div>
          <div className="cs-port-attest-body">
            <p className="cs-port-attest-line">
              Signed off by parent on {formatDate(attestation.attestedAt)}
            </p>
            {attestation.note && (
              <blockquote className="cs-port-attest-note">
                &ldquo;{attestation.note}&rdquo;
              </blockquote>
            )}
          </div>
        </section>
      )}

      <style>{`
        .cs-port-card {
          background: #fff;
          border: 1.5px solid var(--line);
          border-radius: 20px;
          padding: 1.25rem 1.4rem 1.5rem;
          box-shadow: 0 4px 0 rgba(20,32,27,0.04);
          margin-bottom: 1.25rem;
        }
        .cs-port-private {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--muted);
          background: #f1f3f5;
          border-radius: 99px;
          padding: 0.2rem 0.65rem;
          margin-bottom: 0.85rem;
        }
        .cs-port-header {
          display: flex;
          align-items: flex-start;
          gap: 0.85rem;
          margin-bottom: 1.1rem;
          flex-wrap: wrap;
        }
        .cs-port-level-badge {
          flex: none;
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: var(--grape-soft);
          color: var(--grape);
          font-family: var(--font-display);
          font-weight: 800;
          font-size: 1.1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #d8d2f9;
        }
        .cs-port-title {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 1.15rem;
          color: var(--ink);
          margin: 0 0 0.15rem;
        }
        .cs-port-date {
          margin: 0;
          font-size: 0.82rem;
        }
        .cs-port-complete-chip {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--green-deep);
          background: var(--green-soft);
          border: 1.5px solid #c5e4d8;
          border-radius: 99px;
          padding: 0.3rem 0.75rem;
          flex: none;
        }

        /* Milestone list */
        .cs-port-milestones {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .cs-port-milestone {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          color: var(--muted);
          padding: 0.2rem 0;
        }
        .cs-port-milestone--done {
          color: var(--ink);
        }
        .cs-port-milestone-icon {
          width: 20px;
          height: 20px;
          flex: none;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: var(--green-soft);
          color: var(--green-deep);
        }
        .cs-port-milestone--done .cs-port-milestone-icon {
          background: var(--green);
          color: #fff;
        }
        .cs-port-milestone-date {
          margin-left: auto;
          font-size: 0.75rem;
          color: var(--muted);
          white-space: nowrap;
        }

        /* Artifact gallery */
        .cs-port-artifacts {
          list-style: none;
          padding: 0;
          margin: 0.5rem 0 0;
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
          align-items: flex-start;
        }
        .cs-port-artifact {
          max-width: 100%;
        }
        .cs-port-artifact-link {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--green-deep);
          background: var(--green-soft);
          border: 1.5px solid #c5e4d8;
          border-radius: 99px;
          padding: 0.3rem 0.75rem;
          text-decoration: none;
          max-width: 280px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cs-port-artifact-link:hover { background: #d8f0e8; }
        .cs-port-artifact-text {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          max-width: 100%;
        }
        .cs-port-artifact-source {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .cs-port-artifact-quote {
          font-size: 0.88rem;
          color: var(--ink);
          border-left: 3px solid var(--line);
          padding-left: 0.65rem;
          margin: 0;
          word-break: break-word;
        }
        .cs-port-artifact-fig {
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .cs-port-artifact-img {
          display: block;
          max-width: 160px;
          max-height: 120px;
          object-fit: cover;
          border-radius: 10px;
          border: 1.5px solid var(--line);
        }
        .cs-port-artifact-file {
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

        /* Rubric summary */
        .cs-port-rubric {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
        .cs-port-rubric-item {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.82rem;
          font-weight: 700;
          background: #f1f3f5;
          border: 1.5px solid var(--line);
          border-radius: 99px;
          padding: 0.3rem 0.75rem;
          color: var(--muted);
        }
        .cs-port-rubric-item--yes {
          background: var(--green-soft);
          border-color: #c5e4d8;
          color: var(--green-deep);
        }
        .cs-port-rubric-item--no {
          background: #fdecea;
          border-color: #f3b6ae;
          color: #a83228;
        }
        .cs-port-rubric-label {
          /* label text */
        }
        .cs-port-rubric-val {
          font-weight: 800;
        }

        /* Attestation */
        .cs-port-attest {
          display: flex;
          align-items: flex-start;
          gap: 0.65rem;
          background: var(--green-soft);
          border: 1.5px solid #c5e4d8;
          border-radius: 14px;
          padding: 0.85rem 1rem;
          margin-top: 1.25rem;
        }
        .cs-port-attest-icon {
          width: 30px;
          height: 30px;
          flex: none;
          border-radius: 50%;
          background: var(--green);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cs-port-attest-body {
          flex: 1;
          min-width: 0;
        }
        .cs-port-attest-line {
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--green-deep);
          margin: 0 0 0.3rem;
        }
        .cs-port-attest-note {
          font-size: 0.85rem;
          color: var(--ink);
          border-left: 3px solid var(--green);
          padding-left: 0.65rem;
          margin: 0;
          word-break: break-word;
        }

        @media (max-width: 480px) {
          .cs-port-header {
            flex-direction: column;
          }
          .cs-port-complete-chip {
            margin-left: 0;
          }
        }
      `}</style>
    </article>
  );
}
