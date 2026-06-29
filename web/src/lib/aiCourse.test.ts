/**
 * Unit tests for the AI literacy course + capstone subsystem.
 *
 * Covers (against the acceptance criteria in 2026-06-27-ai-literacy-course-design.md):
 *   AC-3.1 / AC-3.2  — isAi8Unlocked / computeAi8Unlocked boundary logic
 *   AC-4.3           — computeMilestoneStatus first-incomplete-wins sequential unlock
 *   AC-4.4           — validateArtifactRequirement enforcement
 *   AC-4.5           — reflect milestone rubric handling (does not block completion)
 *   AC-5.x (billing) — checkAiGate stub is always unlocked (OQ-6 stub)
 *   getAICoursePath  — subject-filtering and active-passage logic via computeReadingPath
 *
 * All tests are pure (no Supabase / network calls). Functions that were previously
 * private have been minimally exported from their source modules to allow this.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// readingServer pure helpers (extracted for testing)
import { computeReadingPath, computeAi8Unlocked } from "./readingServer.ts";

// capstoneServer exports
import { computeMilestoneStatus, validateArtifactRequirement } from "./capstoneServer.ts";

// billing stub
import { checkAiGate } from "./billing.ts";

// types
import type { CapstoneMilestoneRow, CapstoneArtifactRow, CapstoneRequirement } from "./capstoneTypes.ts";

// ---------------------------------------------------------------------------
// Helpers / fixtures
// ---------------------------------------------------------------------------

function makePassage(id: string, week: number, level_order: number): {
  id: string; title: string; week: number; level_order: number;
} {
  return { id, title: `Passage ${id}`, week, level_order };
}

function makeProgress(passageId: string, passed: boolean, attempts = 10, correct = 8): {
  passed_at: string | null; total_attempts: number; total_correct: number;
} {
  return {
    passed_at: passed ? "2026-01-01T00:00:00Z" : null,
    total_attempts: attempts,
    total_correct: correct,
  };
}

function makeMilestoneRow(overrides: Partial<CapstoneMilestoneRow> = {}): CapstoneMilestoneRow {
  return {
    id: "m1",
    capstone_id: "cap1",
    slug: "idea",
    position: 1,
    submitted_at: null,
    rubric: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeArtifact(kind: "url" | "text" | "file", id = "a1"): CapstoneArtifactRow {
  return {
    id,
    milestone_id: "m1",
    kind,
    url: kind === "url" ? "https://example.com" : null,
    body_text: kind === "text" ? "some text" : null,
    storage_path: kind === "file" ? "path/to/file.png" : null,
    mime: kind === "file" ? "image/png" : null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

function noReq(): CapstoneRequirement {
  return { requiresArtifact: false, allowedKinds: [], minCount: 0 };
}

function urlReq(minCount = 1): CapstoneRequirement {
  return { requiresArtifact: true, allowedKinds: ["url"], minCount };
}

function multiKindReq(): CapstoneRequirement {
  return { requiresArtifact: true, allowedKinds: ["url", "file"], minCount: 2 };
}

// ---------------------------------------------------------------------------
// Section 1: computeReadingPath — passage status assignment and subject filtering
// (Tests AC-3.x, the AI course ladder logic, and the active/locked/passed rules)
// ---------------------------------------------------------------------------

test("empty passage list returns zero counts and null activePassageId", () => {
  const result = computeReadingPath([], new Set(), new Map(), 70);
  assert.equal(result.totalPassages, 0);
  assert.equal(result.passedPassages, 0);
  assert.equal(result.activePassageId, null);
  assert.deepEqual(result.weeks, []);
  assert.equal(result.threshold, 70);
});

test("passage without vetted questions is excluded from the path", () => {
  const passages = [makePassage("p1", 1, 1), makePassage("p2", 1, 2)];
  // Only p2 has vetted questions
  const withQ = new Set(["p2"]);
  const progBy = new Map();
  const result = computeReadingPath(passages, withQ, progBy, 70);
  assert.equal(result.totalPassages, 1);
  // p2 is the only one — it becomes active since it's not passed
  assert.equal(result.activePassageId, "p2");
});

test("first unpassed passage becomes active; remaining are locked (AC-3.x, sequential unlock)", () => {
  const passages = [
    makePassage("p1", 1, 1),
    makePassage("p2", 1, 2),
    makePassage("p3", 2, 1),
  ];
  const withQ = new Set(["p1", "p2", "p3"]);
  // p1 passed, p2 not — so p2 is active and p3 is locked
  const progBy = new Map([["p1", makeProgress("p1", true)]]);
  const result = computeReadingPath(passages, withQ, progBy, 70);

  assert.equal(result.totalPassages, 3);
  assert.equal(result.passedPassages, 1);
  assert.equal(result.activePassageId, "p2");

  const allPassages = result.weeks.flatMap((w) => w.passages);
  const byId = Object.fromEntries(allPassages.map((p) => [p.passageId, p.status]));
  assert.equal(byId["p1"], "passed");
  assert.equal(byId["p2"], "active");
  assert.equal(byId["p3"], "locked");
});

test("all passages passed → passedPassages === totalPassages, no active passage", () => {
  const passages = [makePassage("p1", 1, 1), makePassage("p2", 1, 2)];
  const withQ = new Set(["p1", "p2"]);
  const progBy = new Map([
    ["p1", makeProgress("p1", true)],
    ["p2", makeProgress("p2", true)],
  ]);
  const result = computeReadingPath(passages, withQ, progBy, 70);

  assert.equal(result.totalPassages, 2);
  assert.equal(result.passedPassages, 2);
  assert.equal(result.activePassageId, null);
});

test("accuracy is null when no attempts have been made", () => {
  const passages = [makePassage("p1", 1, 1)];
  const withQ = new Set(["p1"]);
  const progBy = new Map([["p1", { passed_at: null, total_attempts: 0, total_correct: 0 }]]);
  const result = computeReadingPath(passages, withQ, progBy, 70);
  assert.equal(result.weeks[0].passages[0].accuracy, null);
});

test("accuracy is computed when attempts > 0", () => {
  const passages = [makePassage("p1", 1, 1)];
  const withQ = new Set(["p1"]);
  // 7 correct out of 10 = 70%
  const progBy = new Map([["p1", { passed_at: null, total_attempts: 10, total_correct: 7 }]]);
  const result = computeReadingPath(passages, withQ, progBy, 70);
  assert.equal(result.weeks[0].passages[0].accuracy, 70);
});

test("passages are grouped into weeks correctly", () => {
  const passages = [
    makePassage("p1", 1, 1),
    makePassage("p2", 1, 2),
    makePassage("p3", 2, 1),
  ];
  const withQ = new Set(["p1", "p2", "p3"]);
  const result = computeReadingPath(passages, withQ, new Map(), 70);

  assert.equal(result.weeks.length, 2);
  assert.equal(result.weeks[0].week, 1);
  assert.equal(result.weeks[0].total, 2);
  assert.equal(result.weeks[1].week, 2);
  assert.equal(result.weeks[1].total, 1);
});

test("week.passed count only counts passed passages within that week", () => {
  const passages = [
    makePassage("p1", 1, 1),
    makePassage("p2", 1, 2),
    makePassage("p3", 2, 1),
  ];
  const withQ = new Set(["p1", "p2", "p3"]);
  const progBy = new Map([["p1", makeProgress("p1", true)]]);
  const result = computeReadingPath(passages, withQ, progBy, 70);

  assert.equal(result.weeks[0].passed, 1);
  assert.equal(result.weeks[1].passed, 0);
});

test("threshold is preserved from the parameter", () => {
  const result = computeReadingPath([], new Set(), new Map(), 80);
  assert.equal(result.threshold, 80);
});

// ---------------------------------------------------------------------------
// Section 2: computeAi8Unlocked — AI 7 → AI 8 cross-level gate (AC-3.1, AC-3.2)
// ---------------------------------------------------------------------------

test("computeAi8Unlocked returns false when requiredIds is empty (no published+vetted ai7)", () => {
  assert.equal(computeAi8Unlocked([], new Set(["p1", "p2"])), false);
});

test("computeAi8Unlocked returns false when none of the required passages are passed", () => {
  const ids = ["ai7-1", "ai7-2", "ai7-3"];
  assert.equal(computeAi8Unlocked(ids, new Set()), false);
});

test("computeAi8Unlocked returns false when only some required passages are passed (AC-3.1 boundary)", () => {
  // 11 of 12 passed → still locked
  const ids = Array.from({ length: 12 }, (_, i) => `ai7-${i + 1}`);
  const passedSet = new Set(ids.slice(0, 11)); // 11 passed, 1 missing
  assert.equal(computeAi8Unlocked(ids, passedSet), false);
});

test("computeAi8Unlocked returns true when ALL required passages are passed (AC-3.2 boundary)", () => {
  // 12 of 12 passed → unlocked
  const ids = Array.from({ length: 12 }, (_, i) => `ai7-${i + 1}`);
  const passedSet = new Set(ids); // all 12 passed
  assert.equal(computeAi8Unlocked(ids, passedSet), true);
});

test("computeAi8Unlocked returns true for a minimal 1-passage course when that passage is passed", () => {
  assert.equal(computeAi8Unlocked(["ai7-only"], new Set(["ai7-only"])), true);
});

test("extra passages in passedSet (from other courses) do not affect the result", () => {
  const ids = ["ai7-1", "ai7-2"];
  const passedSet = new Set(["ai7-1", "reading-99", "math-55"]); // ai7-2 NOT in set
  assert.equal(computeAi8Unlocked(ids, passedSet), false);
  // Now add ai7-2
  passedSet.add("ai7-2");
  assert.equal(computeAi8Unlocked(ids, passedSet), true);
});

// ---------------------------------------------------------------------------
// Section 3: computeMilestoneStatus — sequential unlock (AC-4.3)
// ---------------------------------------------------------------------------

test("first milestone with no submission is active when activeFound is false", () => {
  const m = makeMilestoneRow({ submitted_at: null });
  const activeFound = { value: false };
  const status = computeMilestoneStatus(m, [], noReq(), activeFound);
  assert.equal(status, "active");
  assert.equal(activeFound.value, true);
});

test("second milestone is locked when first is still active", () => {
  const m = makeMilestoneRow({ submitted_at: null });
  const activeFound = { value: true }; // already claimed by a prior milestone
  const status = computeMilestoneStatus(m, [], noReq(), activeFound);
  assert.equal(status, "locked");
});

test("submitted milestone with no artifact requirement is complete", () => {
  const m = makeMilestoneRow({ submitted_at: "2026-06-01T00:00:00Z" });
  const activeFound = { value: false };
  const status = computeMilestoneStatus(m, [], noReq(), activeFound);
  assert.equal(status, "complete");
  // activeFound must NOT be set to true (complete milestone should not claim the active slot)
  assert.equal(activeFound.value, false);
});

test("submitted milestone with satisfied artifact requirement is complete (AC-4.4 interaction)", () => {
  const m = makeMilestoneRow({ submitted_at: "2026-06-01T00:00:00Z" });
  const artifacts = [makeArtifact("url")];
  const req = urlReq(1);
  const activeFound = { value: false };
  const status = computeMilestoneStatus(m, artifacts, req, activeFound);
  assert.equal(status, "complete");
});

test("submitted milestone with unsatisfied artifact requirement is NOT complete — falls to active (AC-4.3/4.4)", () => {
  // The milestone has been submitted but the required artifact is missing
  const m = makeMilestoneRow({ submitted_at: "2026-06-01T00:00:00Z" });
  const req = urlReq(1); // requires a url artifact
  const activeFound = { value: false };
  const status = computeMilestoneStatus(m, [], req, activeFound); // no artifacts
  // Not complete → becomes active (it's the first incomplete one)
  assert.equal(status, "active");
  assert.equal(activeFound.value, true);
});

test("simulate sequential unlock for 6 milestones: M1 active, M2-M6 locked initially", () => {
  const slugs = ["idea", "plan", "build_v1", "test_feedback", "ship", "reflect"];
  const rows = slugs.map((slug, i) =>
    makeMilestoneRow({ id: `m${i + 1}`, slug, position: i + 1, submitted_at: null }),
  );

  const activeFound = { value: false };
  const statuses = rows.map((m) => computeMilestoneStatus(m, [], noReq(), activeFound));

  assert.equal(statuses[0], "active");
  assert.deepEqual(statuses.slice(1), ["locked", "locked", "locked", "locked", "locked"]);
});

test("simulate sequential unlock: after M1 complete, M2 becomes active, M3-M6 locked (AC-4.3)", () => {
  const slugs = ["idea", "plan", "build_v1", "test_feedback", "ship", "reflect"];
  const rows = slugs.map((slug, i) =>
    makeMilestoneRow({
      id: `m${i + 1}`,
      slug,
      position: i + 1,
      submitted_at: i === 0 ? "2026-06-01T00:00:00Z" : null, // M1 submitted
    }),
  );

  const activeFound = { value: false };
  const statuses = rows.map((m) => computeMilestoneStatus(m, [], noReq(), activeFound));

  assert.equal(statuses[0], "complete"); // M1 done
  assert.equal(statuses[1], "active");   // M2 now active
  assert.deepEqual(statuses.slice(2), ["locked", "locked", "locked", "locked"]); // M3-6 locked
});

test("simulate sequential unlock: milestones 1-5 complete → reflect (M6) becomes active (AC-4.3)", () => {
  const slugs = ["idea", "plan", "build_v1", "test_feedback", "ship", "reflect"];
  const rows = slugs.map((slug, i) =>
    makeMilestoneRow({
      id: `m${i + 1}`,
      slug,
      position: i + 1,
      submitted_at: i < 5 ? "2026-06-01T00:00:00Z" : null, // M1-5 submitted, M6 not
    }),
  );

  const activeFound = { value: false };
  const statuses = rows.map((m) => computeMilestoneStatus(m, [], noReq(), activeFound));

  assert.deepEqual(statuses.slice(0, 5), ["complete", "complete", "complete", "complete", "complete"]);
  assert.equal(statuses[5], "active"); // reflect is now active
});

test("all 6 milestones submitted → all complete, no active slot claimed (AC-4.6 precondition)", () => {
  const slugs = ["idea", "plan", "build_v1", "test_feedback", "ship", "reflect"];
  const rows = slugs.map((slug, i) =>
    makeMilestoneRow({
      id: `m${i + 1}`,
      slug,
      position: i + 1,
      submitted_at: "2026-06-01T00:00:00Z",
    }),
  );

  const activeFound = { value: false };
  const statuses = rows.map((m) => computeMilestoneStatus(m, [], noReq(), activeFound));

  assert.deepEqual(statuses, ["complete", "complete", "complete", "complete", "complete", "complete"]);
  assert.equal(activeFound.value, false); // no incomplete milestone was found
});

// ---------------------------------------------------------------------------
// Section 4: validateArtifactRequirement (AC-4.4)
// ---------------------------------------------------------------------------

test("no artifact required → always returns null", () => {
  assert.equal(validateArtifactRequirement(noReq(), []), null);
  assert.equal(validateArtifactRequirement(noReq(), [makeArtifact("url")]), null);
});

test("artifact required but none provided → returns missing_artifact", () => {
  assert.equal(validateArtifactRequirement(urlReq(1), []), "missing_artifact");
});

test("artifact of the wrong kind does not count toward requirement", () => {
  // Requirement is url; only a file artifact provided
  const fileArtifact = makeArtifact("file");
  assert.equal(validateArtifactRequirement(urlReq(1), [fileArtifact]), "missing_artifact");
});

test("artifact of correct kind satisfies the requirement", () => {
  assert.equal(validateArtifactRequirement(urlReq(1), [makeArtifact("url")]), null);
});

test("minCount > 1 requires that many qualifying artifacts (AC-4.4)", () => {
  const req: CapstoneRequirement = { requiresArtifact: true, allowedKinds: ["url"], minCount: 2 };
  assert.equal(validateArtifactRequirement(req, [makeArtifact("url", "a1")]), "missing_artifact");
  assert.equal(
    validateArtifactRequirement(req, [makeArtifact("url", "a1"), makeArtifact("url", "a2")]),
    null,
  );
});

test("multi-kind requirement: any of the allowed kinds counts", () => {
  const req = multiKindReq(); // allowedKinds: ["url", "file"], minCount: 2
  // One url + one file = 2 qualifying → satisfies requirement
  const arts = [makeArtifact("url", "a1"), makeArtifact("file", "a2")];
  assert.equal(validateArtifactRequirement(req, arts), null);
});

test("multi-kind requirement: text artifact is excluded when not in allowedKinds", () => {
  const req = multiKindReq(); // allowedKinds: ["url", "file"], minCount: 2
  // Only text artifact provided — not in allowedKinds
  const arts = [makeArtifact("text", "a1"), makeArtifact("text", "a2")];
  assert.equal(validateArtifactRequirement(req, arts), "missing_artifact");
});

test("extra artifacts beyond minCount do not cause problems", () => {
  const req = urlReq(1);
  const arts = [makeArtifact("url", "a1"), makeArtifact("url", "a2"), makeArtifact("url", "a3")];
  assert.equal(validateArtifactRequirement(req, arts), null);
});

// ---------------------------------------------------------------------------
// Section 5: Reflect milestone rubric (AC-4.5)
// ---------------------------------------------------------------------------

test("reflect milestone with rubric can be complete — rubric does not block (AC-4.5)", () => {
  const m = makeMilestoneRow({
    slug: "reflect",
    submitted_at: "2026-06-01T00:00:00Z",
    rubric: { shipped: true, works: false, documented: true }, // mixed answers
  });
  const activeFound = { value: false };
  // No artifact requirement on reflect milestone
  const status = computeMilestoneStatus(m, [], noReq(), activeFound);
  assert.equal(status, "complete"); // rubric with works:false does NOT block
});

test("reflect milestone without rubric can also complete — rubric is optional for status (AC-4.5)", () => {
  const m = makeMilestoneRow({
    slug: "reflect",
    submitted_at: "2026-06-01T00:00:00Z",
    rubric: null,
  });
  const activeFound = { value: false };
  const status = computeMilestoneStatus(m, [], noReq(), activeFound);
  assert.equal(status, "complete");
});

test("reflect milestone before submission is active (first) or locked (later)", () => {
  const m = makeMilestoneRow({ slug: "reflect", submitted_at: null, rubric: null });
  const af1 = { value: false };
  assert.equal(computeMilestoneStatus(m, [], noReq(), af1), "active");

  const af2 = { value: true };
  assert.equal(computeMilestoneStatus(m, [], noReq(), af2), "locked");
});

// ---------------------------------------------------------------------------
// Section 6: checkAiGate billing stub (OQ-6 / AC billing gate)
// ---------------------------------------------------------------------------

test("checkAiGate always returns locked:false (stub while pricing is undecided)", () => {
  const result = checkAiGate();
  assert.equal(result.locked, false);
});

// ---------------------------------------------------------------------------
// Section 7: computeReadingPath — subject filtering semantics for AI courses
// (These verify that the function used by getAICoursePath handles ai7/ai8 passages
//  with the same sequential-unlock rules as reading passages.)
// ---------------------------------------------------------------------------

test("ai7 passages with correct week ordering produce correct ladder order", () => {
  // 12 AI7 passages across 12 weeks (1 per week for simplicity)
  const passages = Array.from({ length: 12 }, (_, i) =>
    makePassage(`ai7-w${i + 1}`, i + 1, 1),
  );
  const withQ = new Set(passages.map((p) => p.id));
  const progBy = new Map<string, { passed_at: string | null; total_attempts: number; total_correct: number }>();
  const result = computeReadingPath(passages, withQ, progBy, 70);

  assert.equal(result.totalPassages, 12);
  assert.equal(result.activePassageId, "ai7-w1"); // week 1 is first active
  assert.equal(result.weeks.length, 12);
});

test("ai7 w1-w11 passed → w12 is active (last passage unlocks)", () => {
  const passages = Array.from({ length: 12 }, (_, i) =>
    makePassage(`ai7-w${i + 1}`, i + 1, 1),
  );
  const withQ = new Set(passages.map((p) => p.id));
  // Mark passages 1–11 as passed
  const progBy = new Map(
    passages.slice(0, 11).map((p) => [p.id, makeProgress(p.id, true)]),
  );
  const result = computeReadingPath(passages, withQ, progBy, 70);

  assert.equal(result.passedPassages, 11);
  assert.equal(result.activePassageId, "ai7-w12");
});

test("ai7 all 12 passed → passedPassages === totalPassages (course complete, AC-2.5 precondition)", () => {
  const passages = Array.from({ length: 12 }, (_, i) =>
    makePassage(`ai7-w${i + 1}`, i + 1, 1),
  );
  const withQ = new Set(passages.map((p) => p.id));
  const progBy = new Map(passages.map((p) => [p.id, makeProgress(p.id, true)]));
  const result = computeReadingPath(passages, withQ, progBy, 70);

  assert.equal(result.passedPassages, 12);
  assert.equal(result.totalPassages, 12);
  assert.equal(result.activePassageId, null); // no more active
});

test("passages from a different subject (reading) are not included when withQ filters them out", () => {
  // Simulate: getAICoursePath fetches only passages with subject=ai7 from DB.
  // The passages list passed to computeReadingPath is already filtered by subject.
  // We test that if the passages list only contains ai7 IDs, only those appear.
  const ai7Passages = [makePassage("ai7-1", 1, 1), makePassage("ai7-2", 1, 2)];
  const withQ = new Set(["ai7-1", "ai7-2"]); // only ai7 passages have vetted Qs
  const progBy = new Map<string, { passed_at: string | null; total_attempts: number; total_correct: number }>();
  const result = computeReadingPath(ai7Passages, withQ, progBy, 70);

  const ids = result.weeks.flatMap((w) => w.passages.map((p) => p.passageId));
  assert.ok(ids.every((id) => id.startsWith("ai7-")));
  assert.equal(result.totalPassages, 2);
});

// ---------------------------------------------------------------------------
// Section 8: computeMilestoneStatus activeFound is mutated by reference (contract)
// ---------------------------------------------------------------------------

test("activeFound.value is mutated to true exactly once by the first incomplete milestone", () => {
  const m1 = makeMilestoneRow({ id: "m1", position: 1, submitted_at: null });
  const m2 = makeMilestoneRow({ id: "m2", position: 2, submitted_at: null });

  const activeFound = { value: false };
  computeMilestoneStatus(m1, [], noReq(), activeFound);
  assert.equal(activeFound.value, true);

  // m2 sees activeFound already true → locked
  const status2 = computeMilestoneStatus(m2, [], noReq(), activeFound);
  assert.equal(status2, "locked");
  assert.equal(activeFound.value, true); // still true, not flipped again
});

// ---------------------------------------------------------------------------
// Section 9: Edge / boundary cases
// ---------------------------------------------------------------------------

test("a milestone with requiresArtifact:true, minCount:0 can always complete (edge: vacuous requirement)", () => {
  // This would be a misconfigured template but the code handles it defensively
  const req: CapstoneRequirement = { requiresArtifact: true, allowedKinds: ["url"], minCount: 0 };
  assert.equal(validateArtifactRequirement(req, []), null);
});

test("computeAi8Unlocked: single-element required set, not passed → false", () => {
  assert.equal(computeAi8Unlocked(["ai7-1"], new Set()), false);
});

test("computeAi8Unlocked: single-element required set, passed → true", () => {
  assert.equal(computeAi8Unlocked(["ai7-1"], new Set(["ai7-1"])), true);
});

test("computeReadingPath: passage with no progress entry is treated as unpassed", () => {
  const passages = [makePassage("p1", 1, 1)];
  const withQ = new Set(["p1"]);
  // progBy has no entry for p1 — treat as not passed
  const result = computeReadingPath(passages, withQ, new Map(), 70);
  assert.equal(result.weeks[0].passages[0].status, "active");
});
