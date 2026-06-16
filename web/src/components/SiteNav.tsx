import Link from "next/link";

const BrandMark = () => (
  <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="26" height="26" rx="8" fill="#1d9e75" />
    <path d="M9 14h10M14 9v10" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

export function SiteNav() {
  return (
    <nav className="site-nav">
      <Link href="/" className="site-brand">
        <BrandMark />
        Math Tutor
      </Link>
      <div className="site-links">
        <Link href="/how-it-works">How it works</Link>
        <Link href="/curricula">Curricula</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/blog">Blog</Link>
        <Link href="/login" className="site-cta">
          Sign in
        </Link>
      </div>
    </nav>
  );
}
