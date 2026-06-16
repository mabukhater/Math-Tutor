import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import type { CurriculumInfo } from "@/content/curriculaInfo";

export function CurriculumLanding({ info }: { info: CurriculumInfo }) {
  return (
    <MarketingShell>
      <div className="content-wrap">
        <span className={"curr-badge " + info.accent}>{info.levels}</span>
        <h1 style={{ marginTop: "0.6rem" }}>{info.tagline}</h1>
        <p className="sub">{info.intro}</p>

        <Link href="/login" className="btn-cta" style={{ marginBottom: "1.5rem" }}>
          Start free
        </Link>

        <h2 className="section-title">What we cover</h2>
        <div className="strand-list">
          {info.strands.map((s) => (
            <span className="strand-pill" key={s}>
              {s}
            </span>
          ))}
        </div>

        <h2 className="section-title">How it works</h2>
        <ol className="how-list">
          <li>
            <strong>Place them right.</strong> A short adaptive check finds your child&apos;s true
            level on the {info.name} ladder.
          </li>
          <li>
            <strong>Practice daily.</strong> A few aligned questions a day, with spaced repetition
            so skills stick.
          </li>
          <li>
            <strong>See progress.</strong> A mastery map shows what&apos;s solid — and where they
            stand across other curricula, too.
          </li>
        </ol>

        {info.relatedBlog && (
          <p className="muted" style={{ marginTop: "1.25rem" }}>
            Read more: <Link href={`/blog/${info.relatedBlog.slug}`}>{info.relatedBlog.label}</Link>
          </p>
        )}

        <div className="article-cta">
          <h3>Try {info.name} practice</h3>
          <p className="muted">Free during the trial — placement takes a couple of minutes.</p>
          <Link href="/login" className="btn-cta">
            Get started
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
