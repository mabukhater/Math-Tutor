import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAnswer, intervalDays, computeStreak, MASTERED_BOX } from "./practice.ts";

const NOW = new Date("2026-06-16T09:00:00Z");
const base = { box: 0, correct_streak: 0, total_attempts: 0, total_correct: 0 };

test("intervals follow the Leitner schedule", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map(intervalDays),
    [0, 1, 3, 7, 16, 30],
  );
});

test("correct answer moves the box up and schedules by new interval", () => {
  const u = applyAnswer({ ...base, box: 2, correct_streak: 1 }, true, NOW);
  assert.equal(u.box, 3);
  assert.equal(u.correct_streak, 2);
  assert.equal(u.total_correct, 1);
  assert.equal(u.next_due_at, "2026-06-23T09:00:00.000Z"); // +7 days
});

test("box never exceeds mastered", () => {
  const u = applyAnswer({ ...base, box: 5, correct_streak: 9 }, true, NOW);
  assert.equal(u.box, MASTERED_BOX);
  assert.equal(u.next_due_at, "2026-07-16T09:00:00.000Z"); // +30
});

test("wrong answer drops a box, resets streak, due tomorrow", () => {
  const u = applyAnswer({ ...base, box: 3, correct_streak: 4 }, false, NOW);
  assert.equal(u.box, 2);
  assert.equal(u.correct_streak, 0);
  assert.equal(u.next_due_at, "2026-06-17T09:00:00.000Z"); // +1
});

test("box never drops below 0", () => {
  const u = applyAnswer({ ...base, box: 0 }, false, NOW);
  assert.equal(u.box, 0);
});

test("streak counts consecutive completed days ending today", () => {
  assert.equal(computeStreak(["2026-06-14", "2026-06-15", "2026-06-16"], "2026-06-16"), 3);
});

test("streak still stands on yesterday if today isn't done yet", () => {
  assert.equal(computeStreak(["2026-06-14", "2026-06-15"], "2026-06-16"), 2);
});

test("a gap breaks the streak", () => {
  assert.equal(computeStreak(["2026-06-10", "2026-06-15", "2026-06-16"], "2026-06-16"), 2);
  assert.equal(computeStreak([], "2026-06-16"), 0);
});
