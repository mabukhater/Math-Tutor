#!/usr/bin/env python3
"""Programmatically generate VISUAL questions for young grades — no API, no
credits. Because the math behind each visual is fully determined, we can build
guaranteed-correct questions (and templated kid-friendly per-option
explanations) directly, which is safer than asking an LLM.

Types: count, number_line, fraction_bar, array. Each is attached to existing
common_core / uk / singapore skills whose topic + grade fit the visual.

Idempotent: deletes prior source='generated_visual' rows for the targeted
skills, then inserts a fresh set.

Usage:
    export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
    python generator/generate_visual_questions.py --dry-run
    python generator/generate_visual_questions.py
"""
from __future__ import annotations

import argparse
import os
import random
import sys

try:
    from supabase import create_client
    from dotenv import load_dotenv
except ImportError as e:
    sys.exit(f"Missing dependency ({e}). Run: pip install -r generator/requirements.txt")

load_dotenv()
random.seed(20260618)

# Visual type -> (topic codes it belongs under, grades it suits)
TYPE_TOPICS = {
    "count": (["numbers", "add_sub"], {1, 2}),
    "number_line": (["numbers"], {1, 2, 3}),
    "fraction_bar": (["fractions"], {3, 4}),
    "array": (["mult_div"], {2, 3}),
}

ITEMS = ["apples", "stars", "balloons", "frogs", "blocks", "fish"]


def make_options(correct, distractors):
    """Return (options_as_str, correct_index) with 4 distinct values."""
    opts = [correct]
    for d in distractors:
        if d not in opts and len(opts) < 4:
            opts.append(d)
    i = 1
    while len(opts) < 4:  # pad if needed
        cand = correct + i if isinstance(correct, int) else f"{i}/{i+1}"
        if cand not in opts:
            opts.append(cand)
        i += 1
    order = opts[:]
    random.shuffle(order)
    return [str(o) for o in order], order.index(correct)


def gen_count(idx):
    n = 5 + (idx % 6)  # 5..10
    item = ITEMS[idx % len(ITEMS)]
    distractors = [d for d in (n + 1, n - 1, n + 2, n - 2) if d >= 1]
    options, ci = make_options(n, distractors)
    expl = f"Count each one: there are {n}."
    oe = []
    for o in options:
        oe.append(
            f"Yes! Touch each one as you count — there are {n}."
            if int(o) == n
            else f"That looks like {o}. Count again slowly, touching each one once — there are {n}."
        )
    stem = f"How many {item} are there?"
    return stem, options, ci, expl, oe, {"type": "count", "params": {"n": n}}


def gen_number_line(idx):
    span = [(0, 10, 1), (0, 10, 1), (0, 20, 2), (0, 12, 2), (0, 20, 5)][idx % 5]
    mn, mx, step = span
    steps = (mx - mn) // step
    k = 1 + (idx % (steps - 1)) if steps > 1 else 1
    mark = mn + k * step
    distractors = [d for d in (mark + step, mark - step, mark + 1, mark - 1) if mn <= d <= mx]
    options, ci = make_options(mark, distractors)
    by = "" if step == 1 else f" The line counts by {step}s."
    expl = f"Count the ticks from {mn} to the dot: it lands on {mark}.{by}"
    oe = []
    for o in options:
        oe.append(
            f"Yes! Counting from {mn} lands you on {mark}."
            if int(o) == mark
            else f"That's {o}. Count each tick from {mn} carefully to reach {mark}.{by}"
        )
    stem = "What number is the marker on?"
    return stem, options, ci, expl, oe, {
        "type": "number_line",
        "params": {"min": mn, "max": mx, "step": step, "mark": mark},
    }


def gen_fraction_bar(idx):
    parts = [2, 3, 4, 4, 6][idx % 5]
    shaded = 1 + (idx % (parts - 1)) if parts > 1 else 1
    correct = f"{shaded}/{parts}"
    cand = [f"{parts-shaded}/{parts}", f"{shaded}/{parts+1}",
            f"{min(shaded+1, parts)}/{parts}", f"{max(shaded-1,1)}/{parts}"]
    cand = [c for c in cand if c != correct]
    options, ci = make_options(correct, cand)
    expl = f"{shaded} of the {parts} equal parts are shaded, so {shaded}/{parts}."
    oe = []
    for o in options:
        oe.append(
            f"Yes! {shaded} shaded out of {parts} equal parts is {shaded}/{parts}."
            if o == correct
            else f"That's {o}. Count the shaded parts ({shaded}) over the total parts ({parts}): {shaded}/{parts}."
        )
    stem = "What fraction of the bar is shaded?"
    return stem, options, ci, expl, oe, {
        "type": "fraction_bar",
        "params": {"parts": parts, "shaded": shaded},
    }


def gen_array(idx):
    rows = 2 + (idx % 4)  # 2..5
    cols = 2 + ((idx + 2) % 4)
    prod = rows * cols
    cand = [rows + cols, rows * (cols + 1), (rows + 1) * cols, prod + 2, prod - 1]
    cand = [c for c in cand if c != prod and c >= 1]
    options, ci = make_options(prod, cand)
    expl = f"{rows} rows of {cols} is {rows} x {cols} = {prod}."
    oe = []
    for o in options:
        oe.append(
            f"Yes! {rows} rows of {cols} is {rows} x {cols} = {prod}."
            if int(o) == prod
            else f"That's {o}. Here it's {rows} groups of {cols}, so multiply: {rows} x {cols} = {prod}."
        )
    stem = f"There are {rows} rows of {cols} dots. How many dots in all?"
    return stem, options, ci, expl, oe, {"type": "array", "params": {"rows": rows, "cols": cols}}


GEN = {
    "count": gen_count,
    "number_line": gen_number_line,
    "fraction_bar": gen_fraction_bar,
    "array": gen_array,
}
PER_SKILL = 4


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    topics = {t["code"]: t["id"] for t in sb.table("topics").select("id, code").execute().data}
    topic_by_id = {v: k for k, v in topics.items()}

    skills = sb.table("skills").select("id, name, grade, topic_id").lte("grade", 4).execute().data

    rows_to_insert = []
    target_skill_ids = set()
    for vtype, (tcodes, grades) in TYPE_TOPICS.items():
        tids = {topics[c] for c in tcodes if c in topics}
        elig = [s for s in skills if s["topic_id"] in tids and s["grade"] in grades]
        for s in elig:
            target_skill_ids.add(s["id"])
            for k in range(PER_SKILL):
                stem, options, ci, expl, oe, visual = GEN[vtype](k + hash(s["id"]) % 7)
                rows_to_insert.append({
                    "skill_id": s["id"], "stem": stem, "options": options,
                    "correct_index": ci, "explanation": expl, "option_explanations": oe,
                    "difficulty": 2, "status": "vetted", "source": "generated_visual",
                    "visual": visual,
                })

    # De-duplicate within this run by (skill, stem, visual params).
    seen = set()
    unique = []
    for r in rows_to_insert:
        key = (r["skill_id"], r["stem"], str(r["visual"]["params"]))
        if key not in seen:
            seen.add(key)
            unique.append(r)

    print(f"{len(unique)} visual questions for {len(target_skill_ids)} skills"
          + (" (dry run)" if args.dry_run else ""))
    if args.dry_run:
        from collections import Counter
        c = Counter(r["visual"]["type"] for r in unique)
        for t, n in c.items():
            print(f"  {t}: {n}")
        return

    # Idempotent: clear prior generated visuals for these skills, then insert.
    for sid in target_skill_ids:
        sb.table("questions").delete().eq("skill_id", sid).eq("source", "generated_visual").execute()
    for i in range(0, len(unique), 100):
        sb.table("questions").insert(unique[i:i + 100]).execute()
    print(f"inserted {len(unique)} visual questions")


if __name__ == "__main__":
    main()
