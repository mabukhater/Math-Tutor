import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";

export const metadata: Metadata = {
  title: "FAQ — Kareem",
  description: "Common questions about Kareem — curricula, grades, placement, privacy.",
};

const FAQS: { q: string; a: string }[] = [
  {
    q: "Which curricula do you support?",
    a: "Three today: US Common Core, the UK National Curriculum, and Singapore Math. You pick your child's curriculum when you add them, and questions are written in that system's conventions.",
  },
  {
    q: "What ages or grades is it for?",
    a: "Grades 1–8 (US), which is Years 2–9 (UK) and Primary 1–6 & Secondary 1–2 (Singapore) — roughly ages 6 to 14.",
  },
  {
    q: "How does placement work?",
    a: "A short adaptive check — around 8–12 questions — finds the level where your child reliably succeeds, then sets their starting point. No grading by a human or an AI in the moment; it uses your child's own answers.",
  },
  {
    q: "Web or app?",
    a: "Practice works on the web right now. A Telegram option for daily practice and native apps are designed to share the exact same progress, so it's all one account.",
  },
  {
    q: "We might move countries — does that help?",
    a: "Yes. Your child's progress maps across all three systems, so you can see where they'd land if you moved — and keep them on track for both the current and destination curriculum.",
  },
  {
    q: "Is it safe for kids? What about data?",
    a: "We collect as little as possible — a first name or nickname and grade, nothing more. The parent holds the account, children can't self-register, there are no ads, and every question is human-reviewed before it's served.",
  },
  {
    q: "How are the questions made?",
    a: "They're generated offline, then a human reviews and approves each one. The app only ever serves approved questions — never AI-generated math live to a child.",
  },
  {
    q: "How much does it cost?",
    a: "It's free during the trial. Pricing will be shown clearly before any charge.",
  },
];

export default function FAQ() {
  return (
    <MarketingShell>
      <div className="content-wrap">
        <h1>Frequently asked questions</h1>
        <p className="sub">Everything parents usually want to know before getting started.</p>
        <div className="faq-list">
          {FAQS.map((f, i) => (
            <div className="faq-item" key={i}>
              <h3>{f.q}</h3>
              <p className="muted">{f.a}</p>
            </div>
          ))}
        </div>
        <div className="article-cta">
          <h3>Still curious?</h3>
          <p className="muted">The fastest way to understand it is to run a placement.</p>
          <Link href="/login" className="btn-cta">
            Start free
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
