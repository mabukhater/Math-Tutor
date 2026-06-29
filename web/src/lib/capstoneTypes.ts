// Shared types for the capstone subsystem.
// This file is the single source of truth for both the server (API routes) and
// the designer's components (components/capstone/*, components/portfolio/*).
// Do NOT split these across files — both sides import from here.

export type CapstoneLevel = "l7" | "l8";

export type MilestoneStatus = "locked" | "active" | "submitted" | "complete";

export interface KitContent {
  instructions: string;
  promptTemplates: string[];
  checkpointQuestions: string[];
}

export interface CapstoneRequirement {
  requiresArtifact: boolean;
  allowedKinds: ("url" | "text" | "file")[];
  minCount: number;
}

export interface Artifact {
  id: string;
  kind: "url" | "text" | "file";
  url?: string;
  bodyText?: string;
  signedUrl?: string;
  mime?: string;
}

export interface Milestone {
  id: string;
  position: number;
  slug: string;
  title: string;
  status: MilestoneStatus;
  submittedAt: string | null;
  requirement: CapstoneRequirement;
  content: KitContent | null;
  artifacts: Artifact[];
  // Self-assessment answers, set on the "reflect" milestone (AC-4.5); null elsewhere.
  rubric: Rubric | null;
}

export interface Rubric {
  shipped: boolean;
  works: boolean;
  documented: boolean;
}

export type Attestation = {
  parentId: string;
  attestedAt: string;
  note?: string;
} | null;

// ---------------------------------------------------------------------------
// DB row shapes (typed by hand from migration 0022_ai_literacy_course.sql)
// ---------------------------------------------------------------------------

export interface CapstoneRow {
  id: string;
  student_id: string;
  level: 7 | 8;
  created_at: string;
  completed_at: string | null;
}

export interface CapstoneMilestoneRow {
  id: string;
  capstone_id: string;
  slug: string;
  position: number;
  submitted_at: string | null;
  rubric: Rubric | null;
  created_at: string;
}

export interface CapstoneArtifactRow {
  id: string;
  milestone_id: string;
  kind: "url" | "text" | "file";
  url: string | null;
  body_text: string | null;
  storage_path: string | null;
  mime: string | null;
  created_at: string;
}

export interface CapstoneAttestationRow {
  id: string;
  capstone_id: string;
  parent_id: string;
  attested_at: string;
  note: string | null;
}

export interface CapstoneMilestoneTemplateRow {
  id: string;
  level: 7 | 8;
  slug: string;
  position: number;
  title: string;
  description: string;
  requirement: CapstoneRequirement;
  content: KitContent | null;
  created_at: string;
}
