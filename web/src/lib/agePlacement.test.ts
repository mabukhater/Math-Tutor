import { test } from "node:test";
import assert from "node:assert/strict";
import { schoolYearCutoff, suggestGrade } from "./agePlacement.ts";

test("schoolYearCutoff returns this year's Sept 1 when today is after it", () => {
  assert.equal(schoolYearCutoff(new Date("2026-10-15")).toISOString(), "2026-09-01T00:00:00.000Z");
});

test("schoolYearCutoff returns last year's Sept 1 when today is before it", () => {
  assert.equal(schoolYearCutoff(new Date("2026-06-23")).toISOString(), "2025-09-01T00:00:00.000Z");
});

test("a child who is 9 at the cutoff is suggested grade 4", () => {
  // born 2016-05-01 -> age 9 at 2025-09-01 (cutoff for 2026-06-23) -> grade 4
  assert.equal(suggestGrade(new Date("2016-05-01"), new Date("2026-06-23")), 4);
});

test("a just-turned-6 child is grade 1; clamps at the low end", () => {
  assert.equal(suggestGrade(new Date("2019-08-01"), new Date("2026-06-23")), 1); // age 6 -> 1
  assert.equal(suggestGrade(new Date("2022-01-01"), new Date("2026-06-23")), 1); // age 3 -> clamp 1
});

test("an older child clamps at grade 8", () => {
  assert.equal(suggestGrade(new Date("2008-01-01"), new Date("2026-06-23")), 8); // age 17 -> clamp 8
});

test("birthday just before vs after the cutoff shifts the grade by one", () => {
  const today = new Date("2026-10-01");
  assert.equal(suggestGrade(new Date("2017-08-31"), today), 4); // turned 9 before 2026-09-01
  assert.equal(suggestGrade(new Date("2017-09-02"), today), 3); // still 8 at 2026-09-01
});
