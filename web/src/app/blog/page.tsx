import type { Metadata } from "next";
import Link from "next/link";
import { ARTICLES, type Article } from "@/content/articles";
import { MarketingShell } from "@/components/MarketingShell";

export const metadata: Metadata = {
  title: "Blog — Astute Academy",
  description:
    "Parent-friendly guides on early math, curricula, learning science, and raising confident young learners.",
};

const anchor = (cat: string) => cat.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export default function Blog() {
  const cats: string[] = [];
  const byCat: Record<string, Article[]> = {};
  for (const a of ARTICLES) {
    if (!byCat[a.category]) {
      byCat[a.category] = [];
      cats.push(a.category);
    }
    byCat[a.category].push(a);
  }

  return (
    <MarketingShell>
      <div className="blog-layout">
        <main>
          <h1>The Astute Academy blog</h1>
          <p className="sub">
            Practical, parent-friendly guides on early math, curricula, learning science, and
            raising confident young learners.
          </p>

          {cats.map((cat) => (
            <section key={cat} id={anchor(cat)} className="blog-cat-section">
              <h2 className="section-title">
                {cat} <span className="muted">· {byCat[cat].length}</span>
              </h2>
              <div className="blog-grid">
                {byCat[cat].map((a) => (
                  <Link key={a.slug} href={`/blog/${a.slug}`} className="blog-card">
                    <span className="blog-cat">{a.category}</span>
                    <h3>{a.title}</h3>
                    <p className="muted">{a.excerpt}</p>
                    <span className="blog-meta">{a.readMinutes} min read</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </main>

        <aside className="blog-index">
          <div className="blog-index-inner">
            <div className="blog-index-title">Topics</div>
            <nav>
              {cats.map((cat) => (
                <a key={cat} href={`#${anchor(cat)}`}>
                  {cat}
                  <span className="blog-index-count">{byCat[cat].length}</span>
                </a>
              ))}
            </nav>
          </div>
        </aside>
      </div>
    </MarketingShell>
  );
}
