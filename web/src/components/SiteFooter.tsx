import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-cols">
        <div>
          <div className="footer-h">Product</div>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/demo">Try the demo</Link>
          <Link href="/login">Sign in</Link>
        </div>
        <div>
          <div className="footer-h">Curricula</div>
          <Link href="/us">US Common Core</Link>
          <Link href="/uk">UK National</Link>
          <Link href="/singapore">Singapore Math</Link>
        </div>
        <div>
          <div className="footer-h">Learn</div>
          <Link href="/blog">Blog</Link>
          <Link href="/faq">FAQ</Link>
        </div>
        <div>
          <div className="footer-h">Company</div>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <div>
          <div className="footer-h">Legal</div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>
      <div className="footer-base">
        © {new Date().getFullYear()} Astute Academy · An Astute A+ Student · Curriculum-aligned
        math &amp; reading for grades 1–8.
      </div>
    </footer>
  );
}
