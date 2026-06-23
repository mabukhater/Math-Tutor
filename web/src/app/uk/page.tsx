import type { Metadata } from "next";
import { CurriculumLanding } from "@/components/CurriculumLanding";
import { getCurriculumInfo } from "@/content/curriculaInfo";

const INFO = getCurriculumInfo("uk")!;

export const metadata: Metadata = {
  title: "UK National Curriculum Math Practice (Years 2–9) — Astute Academy",
  description: INFO.intro,
};

export default function Page() {
  return <CurriculumLanding info={INFO} />;
}
