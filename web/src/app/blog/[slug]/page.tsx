import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ARTICLES, getArticle, getRelated, getSources } from "@/content/articles";
import { MarketingShell } from "@/components/MarketingShell";
import { Markdown } from "@/components/Markdown";

const SITE = "https://kareem.academy";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) return { title: "Article — Kareem" };
  const title = a.metaTitle ?? a.title;
  const url = `${SITE}/blog/${a.slug}`;
  return {
    title: `${title} — Kareem`,
    description: a.excerpt,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description: a.excerpt,
      url,
      siteName: "Kareem",
    },
    twitter: { card: "summary", title, description: a.excerpt },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) notFound();
  const related = getRelated(a.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: a.title,
    description: a.excerpt,
    articleSection: a.category,
    inLanguage: "en",
    author: { "@type": "Organization", name: "Kareem" },
    publisher: { "@type": "Organization", name: "Kareem" },
    mainEntityOfPage: `${SITE}/blog/${a.slug}`,
  };

  return (
    <MarketingShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="content-wrap article">
        <p>
          <Link href="/blog" className="muted">
            ← All articles
          </Link>
        </p>
        <span className="blog-cat">{a.category}</span>
        <h1>{a.title}</h1>
        <p className="blog-meta">{a.readMinutes} min read</p>
        <Markdown content={a.body} />

        {getSources(a.slug).length > 0 && (
          <div className="sources">
            <h2 className="section-title">Sources &amp; further reading</h2>
            <ul className="source-list">
              {getSources(a.slug).map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="article-cta">
          <h3>Turn this into a daily habit</h3>
          <p className="muted">
            Kareem places your child at their real level and serves a few curriculum-aligned
            questions a day — across US, UK, and Singapore curricula, grades 1–8.
          </p>
          <Link href="/login" className="btn-cta">
            Start free
          </Link>
        </div>

        <h2 className="section-title">Keep reading</h2>
        <div className="blog-grid">
          {related.map((r) => (
            <Link key={r.slug} href={`/blog/${r.slug}`} className="blog-card">
              <span className="blog-cat">{r.category}</span>
              <h3>{r.title}</h3>
              <p className="muted">{r.excerpt}</p>
              <span className="blog-meta">{r.readMinutes} min read</span>
            </Link>
          ))}
        </div>
      </article>
    </MarketingShell>
  );
}
