import { test } from "node:test";
import assert from "node:assert/strict";
import { clampResponseTime, gradeMcqAnswer } from "./grading.ts";

test("clampResponseTime normalizes bad/edge inputs", () => {
  assert.equal(clampResponseTime(1234), 1234);
  assert.equal(clampResponseTime(1234.6), 1235); // rounded
  assert.equal(clampResponseTime(0), 0);
  assert.equal(clampResponseTime(-5), null); // negative
  assert.equal(clampResponseTime(undefined), null);
  assert.equal(clampResponseTime(null), null);
  assert.equal(clampResponseTime("500"), null); // non-number
  assert.equal(clampResponseTime(Infinity), null);
  assert.equal(clampResponseTime(NaN), null);
  assert.equal(clampResponseTime(9_999_999), 3_600_000); // capped at 1h
});

test("gradeMcqAnswer marks a correct answer with no whyWrong", () => {
  const q = { correct_index: 2, explanation: "because", option_explanations: ["a", "b", "c", "d"] };
  const r = gradeMcqAnswer(q, 2);
  assert.equal(r.correct, true);
  assert.equal(r.correctIndex, 2);
  assert.equal(r.whyWrong, null);
  assert.equal(r.correctExplanation, "c"); // per-option for the correct choice
});

test("gradeMcqAnswer returns the per-option whyWrong for a wrong answer", () => {
  const q = { correct_index: 2, explanation: "because", option_explanations: ["a", "b", "c", "d"] };
  const r = gradeMcqAnswer(q, 0);
  assert.equal(r.correct, false);
  assert.equal(r.whyWrong, "a");
  assert.equal(r.correctExplanation, "c");
});

test("gradeMcqAnswer falls back to the single explanation when no per-option list", () => {
  const q = { correct_index: 1, explanation: "the reason", option_explanations: null };
  const r = gradeMcqAnswer(q, 3);
  assert.equal(r.correct, false);
  assert.equal(r.whyWrong, null); // no per-option list -> null
  assert.equal(r.correctExplanation, "the reason");
});
