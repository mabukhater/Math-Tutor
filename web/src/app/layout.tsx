import type { Metadata } from "next";
import "./globals.css";

const SITE = "https://math-tutor-production-f83f.up.railway.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Math Tutor — daily math that follows your child",
  description:
    "Curriculum-aligned daily math practice for grades 1–8 — US Common Core, UK National Curriculum, and Singapore Math.",
  openGraph: { type: "website", siteName: "Math Tutor", url: SITE },
  twitter: { card: "summary" },
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
