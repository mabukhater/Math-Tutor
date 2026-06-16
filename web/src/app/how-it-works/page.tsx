import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";

export const metadata: Metadata = {
  title: "How it works — Math Tutor",
  description: "From sign-up to a daily habit: how Math Tutor places and grows your child.",
};

const STEPS = [
  {
    n: "1",
    h: "Pick the curriculum and level",
    p: "Choose US Common Core, the UK National Curriculum, or Singapore Math, and your child's level. We map it to a full skill ladder for grades 3–5.",
  },
  {
    n: "2",
    h: "Run the adaptive placement",
    p: "A short check — about 8 to 12 questions — steps up and down the ladder to find where your child reliably succeeds, then sets their starting point. No live grading by a human or an AI; it uses your child's own answers.",
  },
  {
    n: "3",
    h: "Practice a few minutes a day",
    p: "Each day brings a small set of questions: a mix of skills that are due for review plus a steady trickle of new ones, never overwhelming. Instant feedback and a one-line explanation on every answer.",
  },
  {
    n: "4",
    h: "Spaced repetition keeps it stuck",
    p: "Every skill moves through review boxes. Get it right and it comes back later; miss it and it returns sooner. That's how short daily practice beats occasional cramming.",
  },
  {
    n: "5",
    h: "Track progress — across every curriculum",
    p: "The parent dashboard shows mastery by topic, streaks, and accuracy. It also shows where your child stands in all three systems, so a move abroad never means starting over.",
  },
];

export default function HowItWorks() {
  return (
    <MarketingShell>
      <div className="content-wrap">
        <h1>How Math Tutor works</h1>
        <p className="sub">
          Set up in minutes. The hard part — staying on track — runs itself.
        </p>
        <ol className="hiw-steps">
          {STEPS.map((s) => (
            <li key={s.n}>
              <div className="hiw-num">{s.n}</div>
              <div>
                <h3>{s.h}</h3>
                <p className="muted">{s.p}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="article-cta">
          <h3>See it with your child</h3>
          <p className="muted">Run a placement, or try a few sample questions first.</p>
          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/login" className="btn-cta">
              Get started
            </Link>
            <Link href="/demo" className="btn-soft">
              Try the demo
            </Link>
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
