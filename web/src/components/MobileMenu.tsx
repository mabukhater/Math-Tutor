"use client";

import Link from "next/link";
import { useState } from "react";

// Shown only on mobile (CSS). A hamburger that opens a dropdown with the nav
// links + the auth CTA, so the header doesn't overflow narrow screens.
export function MobileMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="site-mobile">
      <button
        className="site-burger"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span />
        <span />
        <span />
      </button>
      {open && (
        <div className="site-menu" onClick={() => setOpen(false)}>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/curricula">Curricula</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/blog">Blog</Link>
          <Link href={signedIn ? "/dashboard" : "/login"} className="site-cta">
            {signedIn ? "Dashboard" : "Sign in"}
          </Link>
        </div>
      )}
    </div>
  );
}
