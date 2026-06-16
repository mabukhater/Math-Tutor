import type { Metadata } from "next";
import { MarketingShell } from "@/components/MarketingShell";
import DemoWidget from "./DemoWidget";

export const metadata: Metadata = {
  title: "Try a few questions — Math Tutor",
  description: "Sample real questions from Math Tutor, no sign-up needed.",
};

export default function Demo() {
  return (
    <MarketingShell>
      <div className="content-wrap">
        <h1>Try a few questions</h1>
        <p className="sub">
          A handful of real, human-reviewed questions across the three curricula — no sign-up
          needed. In the app, questions adapt to your child&apos;s exact level.
        </p>
        <div className="card" style={{ marginTop: "1rem" }}>
          <DemoWidget />
        </div>
      </div>
    </MarketingShell>
  );
}
