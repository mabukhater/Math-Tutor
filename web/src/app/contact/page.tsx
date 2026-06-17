import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";

export const metadata: Metadata = {
  title: "Contact — Kareem",
  description: "Get in touch with the Kareem team.",
};

const SUPPORT_EMAIL = "hello@kareem.academy";

export default function Contact() {
  return (
    <MarketingShell>
      <div className="content-wrap" style={{ textAlign: "center" }}>
        <h1>Get in touch</h1>
        <p className="sub" style={{ marginLeft: "auto", marginRight: "auto" }}>
          Questions, feedback, or a curriculum you&apos;d love to see? We read everything.
        </p>

        <div className="price-card" style={{ textAlign: "center" }}>
          <div className="footer-h" style={{ fontSize: "1rem" }}>Email us</div>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="contact-email">
            {SUPPORT_EMAIL}
          </a>
          <p className="muted" style={{ marginTop: "0.75rem" }}>
            We aim to reply within a couple of business days.
          </p>
        </div>

        <p className="muted" style={{ marginTop: "1.25rem" }}>
          Looking for quick answers? Many common questions are covered on our{" "}
          <Link href="/faq">FAQ</Link>.
        </p>
      </div>
    </MarketingShell>
  );
}
