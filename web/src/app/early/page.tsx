import type { Metadata } from "next";
import EarlyLanding from "./EarlyLanding";

export const metadata: Metadata = {
  title: "Astute Academy — early access",
  description: "Curriculum-aligned math that grows with your child. Join the early list.",
  robots: { index: false },
};

export default function EarlyPage() {
  return <EarlyLanding />;
}
