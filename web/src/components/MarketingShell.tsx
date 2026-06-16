import { SiteNav } from "./SiteNav";
import { SiteFooter } from "./SiteFooter";

/** Marketing/content pages share the nav + footer chrome (app pages don't). */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <SiteNav />
      <main className="site-main">{children}</main>
      <SiteFooter />
    </div>
  );
}
