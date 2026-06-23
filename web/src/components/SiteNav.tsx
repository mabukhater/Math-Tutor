import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const BrandMark = () => (
  <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
    <rect width="28" height="28" rx="8" fill="#1d9e75" />
    <text x="12.5" y="20.5" fontFamily="Verdana, Geneva, system-ui, sans-serif" fontSize="18" fontWeight="bold" fill="#fff" textAnchor="middle">A</text>
    <text x="21.5" y="11.5" fontFamily="Verdana, Geneva, system-ui, sans-serif" fontSize="10" fontWeight="bold" fill="#fff" textAnchor="middle">+</text>
  </svg>
);

export async function SiteNav() {
  // Reflect real auth state so the CTA isn't a misleading "Sign in" while logged
  // in. Falls back to signed-out if the session can't be read for any reason.
  let signedIn = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = !!user;
  } catch {
    signedIn = false;
  }

  return (
    <nav className="site-nav">
      <Link href="/" className="site-brand">
        <BrandMark />
        Astute Academy
      </Link>
      <div className="site-links">
        <Link href="/how-it-works">How it works</Link>
        <Link href="/curricula">Curricula</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/blog">Blog</Link>
        <Link href={signedIn ? "/dashboard" : "/login"} className="site-cta">
          {signedIn ? "Dashboard" : "Sign in"}
        </Link>
      </div>
    </nav>
  );
}
