import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { Markdown } from "@/components/Markdown";

export const metadata: Metadata = {
  title: "About — Kareem",
  description: "Why we built curriculum-aligned math practice for globally-mobile families.",
};

const BODY = `Most math apps are built on a single curriculum. That works until a family doesn't fit the mold — a child on the British curriculum living in Madrid, or an American family moving to Singapore for three years. Suddenly "grade-level" practice is aligned to the wrong system, and small gaps start to open up.

## What we believe

Math is close to universal, but how it's taught — the order, the pacing, the labels — is not. A child should be able to practice in the curriculum they're actually in, and stay oriented even when they move between systems.

## What Kareem does

- Lets a parent pick their child's real curriculum — US Common Core, UK National Curriculum, or Singapore Math
- Places the child at their true level with a short adaptive check
- Delivers a few curriculum-aligned questions a day, with spaced repetition so skills stick
- Shows parents a clear mastery map — and where their child sits across all three systems

## How it's built

Every question is human-reviewed before it reaches a child. We collect as little data about children as possible, the parent holds the account, and there are no ads. Practice works on the web today, with Telegram and native apps designed to share the same progress.`;

export default function About() {
  return (
    <MarketingShell>
      <div className="content-wrap article">
        <h1>About Kareem</h1>
        <Markdown content={BODY} />
        <div className="article-cta">
          <h3>Try it with your child</h3>
          <p className="muted">Free during the trial — set up takes a couple of minutes.</p>
          <Link href="/login" className="btn-cta">
            Get started
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
