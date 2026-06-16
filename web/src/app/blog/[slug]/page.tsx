import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ARTICLES, getArticle } from "@/content/articles";
import { MarketingShell } from "@/components/MarketingShell";
import { Markdown } from "@/components/Markdown";
import { formatDate } from "@/lib/date";

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
  return {
    title: a ? `${a.title} — Math Tutor` : "Article — Math Tutor",
    description: a?.excerpt,
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

  return (
    <MarketingShell>
      <article className="content-wrap article">
        <p>
          <Link href="/blog" className="muted">
            ← All articles
          </Link>
        </p>
        <span className="blog-cat">{a.category}</span>
        <h1>{a.title}</h1>
        <p className="blog-meta">
          {formatDate(a.date)} · {a.readMinutes} min read
        </p>
        <Markdown content={a.body} />

        <div className="article-cta">
          <h3>Turn this into a daily habit</h3>
          <p className="muted">
            Math Tutor places your child at their real level and serves a few curriculum-aligned
            questions a day — on the web or Telegram.
          </p>
          <Link href="/login" className="btn-cta">
            Start free
          </Link>
        </div>
      </article>
    </MarketingShell>
  );
}
