"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const ITEMS = [
  { href: "/dashboard", label: "Children" },
  { href: "/billing", label: "Billing & plan" },
  { href: "/account", label: "Account" },
  { href: "/support", label: "Contact us" },
];

const Brand = () => (
  <Link href="/dashboard" className="parent-brand">
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="#1d9e75" />
      <text x="12.5" y="20.5" fontFamily="Verdana, system-ui, sans-serif" fontSize="18" fontWeight="bold" fill="#fff" textAnchor="middle">A</text>
      <text x="21.5" y="11.5" fontFamily="Verdana, system-ui, sans-serif" fontSize="10" fontWeight="bold" fill="#fff" textAnchor="middle">+</text>
    </svg>
    Astute
  </Link>
);

export function SidebarNav({ parentName, email }: { parentName: string; email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <aside className="parent-sidebar">
      <div className="parent-sidebar-top">
        <Brand />
        <button
          className="parent-burger"
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
      </div>

      <div className={"parent-sidebar-body" + (open ? " open" : "")}>
        <nav className="parent-nav" onClick={() => setOpen(false)}>
          {ITEMS.map((it) => {
            const on = pathname === it.href || pathname.startsWith(it.href + "/");
            return (
              <Link key={it.href} href={it.href} className={on ? "on" : ""}>
                {it.label}
              </Link>
            );
          })}
        </nav>
        <div className="parent-sidebar-foot">
          <div className="parent-who">
            <div className="parent-who-name">{parentName || "Parent"}</div>
            <div className="parent-who-email">{email}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button className="parent-signout" type="submit">Sign out</button>
          </form>
        </div>
      </div>
    </aside>
  );
}
