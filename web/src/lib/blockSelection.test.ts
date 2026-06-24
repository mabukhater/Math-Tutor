import { test } from "node:test";
import assert from "node:assert/strict";
import { composeBlock, type VettedQuestion } from "./blockSelection.ts";

const stableRand = () => 0.5; // tie-break (rand - 0.5 = 0) keeps input order, deterministic
function bank(n: number, start = 1): VettedQuestion[] {
  return Array.from({ length: n }, (_, i) => ({ id: `q${start + i}`, difficulty: 3 }));
}

test("first attempt (no previous block) returns blockSize distinct questions", () => {
  const out = composeBlock(bank(30), new Set(), new Map(), 20, stableRand);
  assert.equal(out.length, 20);
  assert.equal(new Set(out).size, 20);
});

test("retry with a 30-question bank is at least half new vs the previous block", () => {
  const v = bank(30);
  const prev = new Set(v.slice(0, 20).map((q) => q.id)); // q1..q20 were just served
  const out = composeBlock(v, prev, new Map(), 20, stableRand);
  assert.equal(out.length, 20);
  const newCount = out.filter((id) => !prev.has(id)).length;
  assert.ok(newCount >= 10, `expected >= 10 new, got ${newCount}`);
});

test("a bank with 20+ unseen makes the retry fully new", () => {
  const v = bank(40);
  const prev = new Set(v.slice(0, 20).map((q) => q.id));
  const out = composeBlock(v, prev, new Map(), 20, stableRand);
  assert.ok(out.every((id) => !prev.has(id)), "all 20 should be new when the bank allows");
});

test("thin bank (== blockSize) degrades to repeats and never errors", () => {
  const v = bank(20);
  const prev = new Set(v.map((q) => q.id)); // everything was in the previous block
  const out = composeBlock(v, prev, new Map(), 20, stableRand);
  assert.equal(out.length, 20); // serves what it has rather than failing
});

test("least-recently-seen questions are preferred (most-recent left out)", () => {
  const v = bank(25);
  const lastSeen = new Map(v.slice(0, 5).map((q) => [q.id, 1000] as const)); // q1..q5 seen most recently
  const out = composeBlock(v, new Set(), lastSeen, 20, stableRand);
  const leftOut = v.filter((q) => !out.includes(q.id)).map((q) => q.id);
  assert.deepEqual(new Set(leftOut), new Set(["q1", "q2", "q3", "q4", "q5"]));
});
