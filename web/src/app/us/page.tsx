import type { Metadata } from "next";
import { CurriculumLanding } from "@/components/CurriculumLanding";
import { getCurriculumInfo } from "@/content/curriculaInfo";

const INFO = getCurriculumInfo("us")!;

export const metadata: Metadata = {
  title: "US Common Core Math Practice (Grades 1–8) — Math Tutor",
  description: INFO.intro,
};

export default function Page() {
  return <CurriculumLanding info={INFO} />;
}
