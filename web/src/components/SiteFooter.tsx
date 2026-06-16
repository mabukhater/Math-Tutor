import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-cols">
        <div>
          <div className="footer-h">Product</div>
          <Link href="/#how">How it works</Link>
          <Link href="/curricula">Curricula</Link>
          <Link href="/login">Sign in</Link>
        </div>
        <div>
          <div className="footer-h">Learn</div>
          <Link href="/blog">Blog</Link>
          <Link href="/faq">FAQ</Link>
        </div>
        <div>
          <div className="footer-h">Company</div>
          <Link href="/about">About</Link>
        </div>
        <div>
          <div className="footer-h">Legal</div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>
      <div className="footer-base">
        © {new Date().getFullYear()} Math Tutor · Curriculum-aligned daily math practice for
        grades 3–5.
      </div>
    </footer>
  );
}
