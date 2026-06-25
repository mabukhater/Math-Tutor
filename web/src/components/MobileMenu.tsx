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
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <>
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </>
          ) : (
            <>
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </>
          )}
        </svg>
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
