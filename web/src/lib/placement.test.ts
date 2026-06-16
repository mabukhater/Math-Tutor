import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initPlacement,
  recordAnswer,
  gradeRange,
  MAX_STEPS,
  type LadderSkill,
} from "./placement.ts";

// Mirror the real Common Core 3-5 ladder shape: 24 + 27 + 24 = 75 rungs.
// grade 3 = 0..23, grade 4 = 24..50, grade 5 = 51..74.
function buildLadder(): LadderSkill[] {
  const counts: [number, number][] = [
    [3, 24],
    [4, 27],
    [5, 24],
  ];
  const ladder: LadderSkill[] = [];
  let index = 0;
  for (const [grade, n] of counts) {
    for (let i = 0; i < n; i++) ladder.push({ index: index++, grade });
  }
  return ladder;
}

const LADDER = buildLadder();

/** A child who answers correctly iff the rung is at or below their true level. */
function simulate(nominalGrade: number, trueLevel: number) {
  let st = initPlacement(LADDER, nominalGrade);
  let guard = 0;
  while (!st.done) {
    st = recordAnswer(st, st.estimate <= trueLevel);
    if (++guard > MAX_STEPS + 1) throw new Error("did not terminate");
  }
  return st;
}

test("gradeRange returns contiguous bounds", () => {
  assert.deepEqual(gradeRange(LADDER, 3), [0, 23]);
  assert.deepEqual(gradeRange(LADDER, 4), [24, 50]);
  assert.deepEqual(gradeRange(LADDER, 5), [51, 74]);
  assert.equal(gradeRange(LADDER, 6), null);
});

test("initPlacement starts at grade floor, window spans into next grade", () => {
  const st = initPlacement(LADDER, 4);
  assert.equal(st.low, 24); // start of grade 4
  assert.equal(st.estimate, 24);
  assert.equal(st.high, 74); // end of grade 5 (one grade up)
  assert.equal(st.n, 74);
});

test("top grade has no grade-up; window ends at its own last rung", () => {
  const st = initPlacement(LADDER, 5);
  assert.equal(st.low, 51);
  assert.equal(st.high, 74);
});

test("always converges within MAX_STEPS", () => {
  for (let L = 0; L <= 74; L += 1) {
    for (const g of [3, 4, 5]) {
      const st = simulate(g, L);
      assert.ok(st.done, `not done for grade ${g}, level ${L}`);
      assert.ok(
        st.asked.length <= MAX_STEPS,
        `took ${st.asked.length} steps for grade ${g}, level ${L}`,
      );
      assert.ok(st.estimatedIndex !== null);
    }
  }
});

test("places near true level when the child sits inside the search window", () => {
  // grade 4 window is [24, 74]
  for (const L of [24, 30, 37, 45, 50, 60, 70]) {
    const st = simulate(4, L);
    assert.ok(
      Math.abs((st.estimatedIndex as number) - L) <= 2,
      `grade 4, true ${L} -> placed ${st.estimatedIndex} (off by >2)`,
    );
  }
});

test("a child below their nominal grade lands at/under the grade floor", () => {
  // true level 10 (grade 3) but parent said grade 4 -> floor is index 24
  const st = simulate(4, 10);
  assert.ok((st.estimatedIndex as number) <= 24);
});

test("a child far ahead lands near the top of the window", () => {
  const st = simulate(4, 74);
  assert.ok((st.estimatedIndex as number) >= 72);
});

test("two trailing wrong answers nudge the placement down one", () => {
  // Hand-drive: correct once (low moves up), then two wrongs to force the nudge.
  let st = initPlacement(LADDER, 4); // low24 est24 high74
  st = recordAnswer(st, true); // low->24, est->round((24+74)/2)=49
  const beforeLow = st.low;
  st = recordAnswer(st, false); // high->49, est->round((24+49)/2)=37
  st = recordAnswer(st, false); // high->37, est->round((24+37)/2)=31...
  // keep failing to convergence
  while (!st.done) st = recordAnswer(st, false);
  // last two answers were wrong -> estimatedIndex nudged below `low`
  assert.ok((st.estimatedIndex as number) <= beforeLow);
});
