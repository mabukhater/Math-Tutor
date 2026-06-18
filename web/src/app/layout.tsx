import type { Metadata } from "next";
import "./globals.css";

const SITE = "https://kareem.academy";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Kareem — daily math that follows your child",
  description:
    "Curriculum-aligned daily math practice for grades 1–8 — US Common Core, UK National Curriculum, and Singapore Math.",
  openGraph: { type: "website", siteName: "Kareem", url: SITE },
  twitter: { card: "summary_large_image" },
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
      <body>{children}</body>
    </html>
  );
}
