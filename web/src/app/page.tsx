import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MarketingShell } from "@/components/MarketingShell";
import { ARTICLES } from "@/content/articles";

/* --- inline SVG icons (no emoji as UI icons) --- */
const S = (p: { size?: number; children: React.ReactNode }) => (
  <svg
    width={p.size ?? 22}
    height={p.size ?? 22}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {p.children}
  </svg>
);
const BookIcon = ({ size }: { size?: number }) => (
  <S size={size}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </S>
);
const TargetIcon = ({ size }: { size?: number }) => (
  <S size={size}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" />
  </S>
);
const BoltIcon = ({ size }: { size?: number }) => (
  <S size={size}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </S>
);
const CheckIcon = ({ size }: { size?: number }) => (
  <S size={size}>
    <path d="M20 6 9 17l-5-5" />
  </S>
);
const ArrowIcon = ({ size }: { size?: number }) => (
  <S size={size}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </S>
);
const FlameIcon = ({ size }: { size?: number }) => (
  <S size={size}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </S>
);
const LogoMark = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <rect width="28" height="28" rx="8" fill="#1d9e75" />
    <path
      d="M10 7.5v13M10 14l8-6.5M10 14l8 6.5"
      stroke="#fff"
      strokeWidth="2.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default async function Landing() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <MarketingShell>
      <div className="lp">
        <span className="blob blob-1" />
        <span className="blob blob-2" />
        <span className="blob blob-3" />

      <section className="hero">
        <span className="eyebrow">
          <BookIcon size={15} /> US · UK · Singapore curricula
        </span>
        <h1>
          Math &amp; reading that <span className="pop-green">follow</span> your child
          <span className="pop-amber">.</span>
        </h1>
        <p className="lead">
          Curriculum-aligned math and leveled reading comprehension. A quick check finds your
          child&apos;s level, then a daily climb of lessons and passages keeps them growing.
        </p>
        <div className="cta-row">
          <Link href="/login" className="btn-cta">
            Get started free <ArrowIcon size={18} />
          </Link>
          <a href="#how" className="btn-soft">
            See how it works
          </a>
        </div>

        <div className="hero-card" aria-hidden="true">
          <div className="q">What is 4 × 3?</div>
          <div className="choice">A. 7</div>
          <div className="choice right">
            B. 12
            <span className="tick">
              <CheckIcon size={18} />
            </span>
          </div>
          <div className="choice">C. 9</div>
          <span className="streak-chip">
            <FlameIcon size={14} /> 5-day streak
          </span>
        </div>
      </section>

      <section className="section">
        <h2>Built for your child’s real curriculum</h2>
        <p className="sub-c">Not a one-size-fits-all syllabus — pick the system they’re actually in.</p>
        <div className="curricula-row">
          <div className="curr-card c1">
            <div className="curr-name">US Common Core</div>
            <div className="curr-lvl">Grades 1–8</div>
          </div>
          <div className="curr-card c2">
            <div className="curr-name">UK National Curriculum</div>
            <div className="curr-lvl">Years 2–9</div>
          </div>
          <div className="curr-card c3">
            <div className="curr-name">Singapore Math</div>
            <div className="curr-lvl">Primary 1–6 & Secondary 1–2</div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Two subjects, one climb</h2>
        <p className="sub-c">Your child builds skills step by step in both — same account, same progress.</p>
        <div className="curricula-row">
          <div className="curr-card c1">
            <div className="curr-name">Math</div>
            <div className="curr-lvl">Mastery ladder · grades 1–8</div>
            <p className="muted" style={{ marginTop: "0.55rem", fontSize: "0.88rem" }}>
              Read a short lesson, then practice until it sticks. Pass to unlock the next week.
              Picture-based questions for younger kids.
            </p>
          </div>
          <div className="curr-card c2">
            <div className="curr-name">Reading comprehension</div>
            <div className="curr-lvl">Leveled passages, week by week</div>
            <p className="muted" style={{ marginTop: "0.55rem", fontSize: "0.88rem" }}>
              Read a passage, answer questions. Wrong answer? A hint points to the exact
              paragraph — teaching them to find the evidence.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="ontario-band">
          <span className="ontario-flag">🍁 New · Ontario Grade 4</span>
          <h2>The whole school year, mapped week by week</h2>
          <p>
            Enroll your Grade 4 child in the full <strong>Ontario 2020 curriculum</strong> as a
            September-to-June plan. Every week has its math focus and a reading passage, tied to the
            real Ontario expectations — so you always know what they’re learning and whether they’re
            on pace.
          </p>
          <div className="ontario-feats">
            <span className="pill"><CheckIcon size={16} /> 36-week Sept–June schedule</span>
            <span className="pill"><CheckIcon size={16} /> Mapped to Ontario expectations</span>
            <span className="pill"><CheckIcon size={16} /> Live coverage &amp; pace tracking</span>
          </div>
          <Link href="/login" className="btn-cta" style={{ marginTop: "1.4rem" }}>
            Start the Ontario year plan <ArrowIcon size={18} />
          </Link>
        </div>
      </section>

      <section className="section" id="how">
        <h2>Three steps to daily momentum</h2>
        <p className="sub-c">Set up in minutes — the hard part, staying on track, runs itself.</p>
        <div className="steps">
          <div className="step">
            <div className="chip chip-sky">
              <BookIcon />
            </div>
            <h3>Pick the curriculum</h3>
            <p>Choose your child&apos;s grade and curriculum. We map it to a full skill ladder.</p>
          </div>
          <div className="step">
            <div className="chip chip-amber">
              <TargetIcon />
            </div>
            <h3>Find their level</h3>
            <p>A short adaptive check places them right where they&apos;re ready to grow.</p>
          </div>
          <div className="step">
            <div className="chip chip-grape">
              <BoltIcon />
            </div>
            <h3>Climb every day</h3>
            <p>A short lesson or passage, then questions — pass to unlock the next rung, in math and reading.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="trust">
          <span className="pill">
            <CheckIcon size={16} /> Curriculum-aligned
          </span>
          <span className="pill">
            <CheckIcon size={16} /> Parent-controlled account
          </span>
          <span className="pill">
            <CheckIcon size={16} /> Human-reviewed questions
          </span>
          <span className="pill">
            <CheckIcon size={16} /> No ads, ever
          </span>
        </div>
      </section>

        <section className="section">
          <h2>From the blog</h2>
          <p className="sub-c">Parent-friendly reads on early math, curricula, and habits.</p>
          <div className="blog-grid">
            {ARTICLES.slice(0, 3).map((a) => (
              <Link key={a.slug} href={`/blog/${a.slug}`} className="blog-card">
                <span className="blog-cat">{a.category}</span>
                <h3>{a.title}</h3>
                <p className="muted">{a.excerpt}</p>
                <span className="blog-meta">{a.readMinutes} min read</span>
              </Link>
            ))}
          </div>
          <p style={{ textAlign: "center", marginTop: "1rem" }}>
            <Link href="/blog" className="muted">
              All articles →
            </Link>
          </p>
        </section>

        <section className="cta-band">
          <h2>Start your child today</h2>
          <p>Free during the trial. No card required.</p>
          <Link href="/login" className="btn-cta">
            Create a free account <ArrowIcon size={18} />
          </Link>
        </section>
      </div>
    </MarketingShell>
  );
}
