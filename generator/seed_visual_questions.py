#!/usr/bin/env python3
"""Seed a few hand-written VISUAL questions (no API) for grades 1-3, so the
parametric-visual flow is demonstrable end to end. Each attaches to an existing
common_core skill in the right (grade, topic), and is inserted as vetted with
kid-friendly per-option explanations.

Usage:
    export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
    python generator/seed_visual_questions.py
"""
from __future__ import annotations

import os
import sys

try:
    from supabase import create_client
    from dotenv import load_dotenv
except ImportError as e:
    sys.exit(f"Missing dependency ({e}). Run: pip install -r generator/requirements.txt")

load_dotenv()

# grade, topic_code, stem, options, correct_index, explanation, per-option notes, visual
QUESTIONS = [
    (1, "numbers", "How many apples are there?",
     ["6", "7", "8", "9"], 1,
     "Count each apple once: 1, 2, 3, 4, 5, 6, 7. There are 7.",
     ["Close! Try pointing to each apple as you count — you may have missed one.",
      "Yes! You counted every apple once and got 7.",
      "Not quite — that's one too many. Count again slowly.",
      "That's too many. Touch each apple once so you don't count any twice."],
     {"type": "count", "params": {"n": 7}}),
    (1, "numbers", "Where is the frog sitting on the number line?",
     ["5", "6", "7", "8"], 1,
     "Start at 0 and count the jumps to the frog: it lands on 6.",
     ["So close — count one more jump from 5.",
      "Yes! The frog is right on 6.",
      "That's one too far. Count back one.",
      "Too far along — start at 0 and count the ticks again."],
     {"type": "number_line", "params": {"min": 0, "max": 10, "step": 1, "mark": 6}}),
    (2, "numbers", "What number is the marker on?",
     ["12", "14", "16", "18"], 1,
     "The line counts by 2s. The marker sits on 14.",
     ["Close — that's one tick too early. The line jumps by 2s.",
      "Yes! Counting by 2s lands you on 14.",
      "One tick too far — count back by 2.",
      "Too far along. Remember each step is 2, not 1."],
     {"type": "number_line", "params": {"min": 0, "max": 20, "step": 2, "mark": 14}}),
    (3, "fractions", "What fraction of the bar is shaded?",
     ["1/4", "2/4", "3/4", "4/4"], 2,
     "The bar has 4 equal parts and 3 are shaded, so 3/4.",
     ["Only 1 part would be 1/4 — count the shaded parts again.",
      "That's 2 shaded parts; look, there are 3.",
      "Yes! 3 shaded parts out of 4 equal parts is 3/4.",
      "4/4 means the whole bar — but one part is still empty."],
     {"type": "fraction_bar", "params": {"parts": 4, "shaded": 3}}),
    (3, "fractions", "What fraction of the bar is shaded?",
     ["1/3", "1/2", "2/3", "1/4"], 0,
     "The bar is split into 3 equal parts and 1 is shaded, so 1/3.",
     ["Yes! 1 shaded part out of 3 equal parts is 1/3.",
      "Halves would need 2 equal parts — this bar has 3.",
      "That would be 2 shaded parts; only 1 is shaded.",
      "Quarters need 4 equal parts — count the parts: there are 3."],
     {"type": "fraction_bar", "params": {"parts": 3, "shaded": 1}}),
    (3, "mult_div", "There are 3 rows of 4 dots. How many dots in all?",
     ["7", "9", "12", "16"], 2,
     "3 rows of 4 is 3 x 4 = 12 dots.",
     ["That looks like 3 + 4. Here we have 3 groups of 4, so multiply.",
      "Count the rows and dots again — 3 rows of 4 isn't 9.",
      "Yes! 3 rows of 4 is 3 x 4 = 12.",
      "That's 4 x 4. There are only 3 rows, not 4."],
     {"type": "array", "params": {"rows": 3, "cols": 4}}),
]


def main() -> None:
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    cc = sb.table("curricula").select("id").eq("code", "common_core").single().execute().data["id"]
    topics = {t["code"]: t["id"] for t in sb.table("topics").select("id, code").execute().data}

    inserted = 0
    for grade, tcode, stem, options, ci, expl, opt_expl, visual in QUESTIONS:
        skills = (
            sb.table("skills")
            .select("id, name")
            .eq("curriculum_id", cc)
            .eq("grade", grade)
            .eq("topic_id", topics[tcode])
            .limit(1)
            .execute()
            .data
        )
        if not skills:
            print(f"  skip (no skill): G{grade} {tcode} — {stem[:40]}")
            continue
        skill_id = skills[0]["id"]
        # Avoid duplicates on re-run: skip if this exact stem already exists.
        exists = (
            sb.table("questions").select("id").eq("skill_id", skill_id).eq("stem", stem).execute().data
        )
        if exists:
            print(f"  exists: G{grade} {tcode} — {stem[:40]}")
            continue
        sb.table("questions").insert({
            "skill_id": skill_id,
            "stem": stem,
            "options": options,
            "correct_index": ci,
            "explanation": expl,
            "option_explanations": opt_expl,
            "difficulty": 2,
            "status": "vetted",
            "source": "hand_authored_visual",
            "visual": visual,
        }).execute()
        inserted += 1
        print(f"  + G{grade} {tcode} [{visual['type']}] — {stem[:40]}")

    print(f"\ninserted {inserted} visual questions")


if __name__ == "__main__":
    main()
