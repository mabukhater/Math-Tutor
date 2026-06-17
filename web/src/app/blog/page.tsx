import type { Metadata } from "next";
import Link from "next/link";
import { ARTICLES } from "@/content/articles";
import { MarketingShell } from "@/components/MarketingShell";

export const metadata: Metadata = {
  title: "Blog — Math Tutor",
  description: "Parent-friendly takes on raising confident young mathematicians.",
};

export default function Blog() {
  return (
    <MarketingShell>
      <div className="content-wrap">
        <h1>The Math Tutor blog</h1>
        <p className="sub">
          Practical, parent-friendly takes on early math, curricula, and raising confident
          young mathematicians.
        </p>
        <div className="blog-grid">
          {ARTICLES.map((a) => (
            <Link key={a.slug} href={`/blog/${a.slug}`} className="blog-card">
              <span className="blog-cat">{a.category}</span>
              <h3>{a.title}</h3>
              <p className="muted">{a.excerpt}</p>
              <span className="blog-meta">{a.readMinutes} min read</span>
            </Link>
          ))}
        </div>
      </div>
    </MarketingShell>
  );
}
