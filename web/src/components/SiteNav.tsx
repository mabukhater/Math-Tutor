import Link from "next/link";

const BrandMark = () => (
  <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
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

export function SiteNav() {
  return (
    <nav className="site-nav">
      <Link href="/" className="site-brand">
        <BrandMark />
        Kareem
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
