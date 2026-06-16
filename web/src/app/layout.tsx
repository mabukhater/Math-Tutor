import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Math Tutor",
  description: "Curriculum-aligned daily math practice for grades 3–5.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
