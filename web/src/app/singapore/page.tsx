import type { Metadata } from "next";
import { CurriculumLanding } from "@/components/CurriculumLanding";
import { getCurriculumInfo } from "@/content/curriculaInfo";

const INFO = getCurriculumInfo("singapore")!;

export const metadata: Metadata = {
  title: "Singapore Math Practice (Primary 3–5) — Math Tutor",
  description: INFO.intro,
};

export default function Page() {
  return <CurriculumLanding info={INFO} />;
}
