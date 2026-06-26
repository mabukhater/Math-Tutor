import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PWARegister } from "@/components/PWARegister";
import { JsonLd } from "@/components/JsonLd";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://astute.academy";

const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "Astute Academy",
  url: SITE,
  logo: `${SITE}/icon.svg`,
  description:
    "Curriculum-aligned math and leveled reading practice for children in grades 1–8 — US Common Core, UK National Curriculum, Singapore Math, and Ontario.",
};

const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Astute Academy",
  url: SITE,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Astute Academy — math & reading that follow your child",
  description:
    "Curriculum-aligned math and leveled reading comprehension for grades 1–8 — US Common Core, UK National Curriculum, and Singapore Math.",
  applicationName: "Astute Academy",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Astute Academy", statusBarStyle: "default" },
  openGraph: { type: "website", siteName: "Astute Academy", url: SITE },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#1d9e75",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <JsonLd data={ORG_SCHEMA} />
        <JsonLd data={WEBSITE_SCHEMA} />
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
