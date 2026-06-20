import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PWARegister } from "@/components/PWARegister";

const SITE = "https://kareem.academy";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Kareem — math & reading that follow your child",
  description:
    "Curriculum-aligned math and leveled reading comprehension for grades 1–8 — US Common Core, UK National Curriculum, and Singapore Math.",
  applicationName: "Kareem",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Kareem", statusBarStyle: "default" },
  openGraph: { type: "website", siteName: "Kareem", url: SITE },
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
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
