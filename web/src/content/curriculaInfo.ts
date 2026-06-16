export interface CurriculumInfo {
  slug: string; // /us, /uk, /singapore
  name: string;
  tagline: string;
  levels: string;
  accent: "c1" | "c2" | "c3";
  intro: string;
  strands: string[];
  relatedBlog?: { slug: string; label: string };
}

export const CURRICULA_INFO: CurriculumInfo[] = [
  {
    slug: "us",
    name: "US Common Core",
    tagline: "Curriculum-aligned math practice for Grades 3–5",
    levels: "Grades 3–5",
    accent: "c1",
    intro:
      "The US Common Core State Standards emphasize understanding the why behind the math, with reasoning and clear explanation at the center. Math Tutor places your child on the full Grade 3–5 skill ladder and gives them a few aligned questions a day.",
    strands: [
      "Operations & Algebraic Thinking",
      "Number & Operations in Base Ten",
      "Number & Operations — Fractions",
      "Measurement & Data",
      "Geometry",
    ],
    relatedBlog: {
      slug: "common-core-uk-national-curriculum-singapore-math-difference",
      label: "How Common Core compares to the UK and Singapore",
    },
  },
  {
    slug: "uk",
    name: "UK National Curriculum",
    tagline: "Curriculum-aligned math practice for Years 4–6",
    levels: "Years 4–6",
    accent: "c2",
    intro:
      "The UK National Curriculum sets clear year-by-year expectations and prizes fluent arithmetic alongside problem solving. Math Tutor follows the Years 4–6 programme of study, in British conventions, and adapts to your child's level.",
    strands: [
      "Number & Place Value",
      "Addition, Subtraction, Multiplication & Division",
      "Fractions, Decimals & Percentages",
      "Ratio, Proportion & Algebra",
      "Measurement & Geometry",
      "Statistics",
    ],
    relatedBlog: {
      slug: "common-core-uk-national-curriculum-singapore-math-difference",
      label: "How the UK curriculum compares to the US and Singapore",
    },
  },
  {
    slug: "singapore",
    name: "Singapore Math",
    tagline: "Mastery-based math practice for Primary 3–5",
    levels: "Primary 3–5",
    accent: "c3",
    intro:
      "Singapore Math is built on mastery — concrete to pictorial to abstract, with the bar-model method and a careful, cumulative sequence. Math Tutor follows the Primary 3–5 syllabus and keeps each idea secure before moving on.",
    strands: [
      "Whole Numbers, Multiplication & Division",
      "Fractions & Decimals",
      "Money, Measurement, Area & Volume",
      "Percentage, Ratio & Rate",
      "Geometry",
      "Statistics",
    ],
    relatedBlog: {
      slug: "what-singapore-math-actually-is",
      label: "What “Singapore Math” actually is",
    },
  },
];

export function getCurriculumInfo(slug: string): CurriculumInfo | undefined {
  return CURRICULA_INFO.find((c) => c.slug === slug);
}
