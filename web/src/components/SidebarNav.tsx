"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  return (
    <aside className="parent-sidebar">
      <Brand />
      <nav className="parent-nav">
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
    </aside>
  );
}
