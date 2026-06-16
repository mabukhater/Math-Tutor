import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";

export const metadata: Metadata = {
  title: "Curricula — Math Tutor",
  description:
    "US Common Core, UK National Curriculum, and Singapore Math — and how your child's level maps across all three.",
};

const EQUIV = [
  { age: "≈ 8–9", us: "Grade 3", uk: "Year 4", sg: "Primary 3" },
  { age: "≈ 9–10", us: "Grade 4", uk: "Year 5", sg: "Primary 4" },
  { age: "≈ 10–11", us: "Grade 5", uk: "Year 6", sg: "Primary 5" },
];

export default function Curricula() {
  return (
    <MarketingShell>
      <div className="content-wrap">
        <h1>Your child&apos;s real curriculum — and every other one</h1>
        <p className="sub">
          Pick the system your child is actually in. We&apos;ll place them at their level and
          show you where they&apos;d stand in the others, too.
        </p>

        <div className="curricula-row" style={{ marginTop: "1.5rem" }}>
          <div className="curr-card c1">
            <div className="curr-name">US Common Core</div>
            <div className="curr-lvl">Grades 3–5</div>
            <p className="muted" style={{ marginTop: "0.6rem", fontSize: "0.88rem" }}>
              Depth over breadth — understanding the why, explaining reasoning.
            </p>
          </div>
          <div className="curr-card c2">
            <div className="curr-name">UK National Curriculum</div>
            <div className="curr-lvl">Years 4–6</div>
            <p className="muted" style={{ marginTop: "0.6rem", fontSize: "0.88rem" }}>
              Clear year-by-year objectives with strong arithmetic fluency.
            </p>
          </div>
          <div className="curr-card c3">
            <div className="curr-name">Singapore Math</div>
            <div className="curr-lvl">Primary 3–5</div>
            <p className="muted" style={{ marginTop: "0.6rem", fontSize: "0.88rem" }}>
              Mastery-based — concrete to pictorial to abstract, bar models.
            </p>
          </div>
        </div>

        <h2 className="section-title" style={{ marginTop: "2.25rem" }}>
          On track for both systems
        </h2>
        <p className="muted" style={{ marginBottom: "1rem" }}>
          The labels differ, but the levels line up. A child placed at one level is, at a glance,
          here in every system — so a move abroad never means starting over.
        </p>

        <div className="equiv-wrap">
          <table className="equiv-table">
            <thead>
              <tr>
                <th>Age</th>
                <th>US Common Core</th>
                <th>UK National</th>
                <th>Singapore</th>
              </tr>
            </thead>
            <tbody>
              {EQUIV.map((r) => (
                <tr key={r.us}>
                  <td className="muted">{r.age}</td>
                  <td>{r.us}</td>
                  <td>{r.uk}</td>
                  <td>{r.sg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="muted" style={{ marginTop: "1rem" }}>
          Want the detail? Read{" "}
          <Link href="/blog/common-core-uk-national-curriculum-singapore-math-difference">
            how the three systems compare
          </Link>{" "}
          or{" "}
          <Link href="/blog/moving-abroad-with-school-age-kids-keeping-math-on-track">
            keeping math on track when you move
          </Link>
          .
        </p>

        <div className="article-cta">
          <h3>See your child&apos;s cross-curriculum level</h3>
          <p className="muted">
            Run a quick placement and the dashboard shows where they stand in all three systems.
          </p>
          <Link href="/login" className="btn-cta">
            Get started
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
