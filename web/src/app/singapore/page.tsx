import type { Metadata } from "next";
import { CurriculumLanding } from "@/components/CurriculumLanding";
import { getCurriculumInfo } from "@/content/curriculaInfo";

const INFO = getCurriculumInfo("singapore")!;

export const metadata: Metadata = {
  title: "Singapore Math Practice (Primary 1–6 & Secondary 1–2) — Kareem",
  description: INFO.intro,
};

export default function Page() {
  return <CurriculumLanding info={INFO} />;
}
