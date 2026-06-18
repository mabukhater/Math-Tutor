#!/usr/bin/env python3
"""Seed a few hand-written, kid-friendly lessons (no API). These demonstrate the
"learn before you practice" flow end-to-end for topics that already have
questions. Bulk lesson generation (generate_lessons.py) fills in the rest later.

Markdown supported by the web renderer: ## / ### headings, blank-line paragraphs,
and "- " bullet lists. No inline bold.

Usage:
    export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
    python generator/seed_lessons.py
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

# (curriculum_code, topic_code, grade, title, body)
LESSONS = [
    (
        "common_core", "add_sub", 1, "Adding and Taking Away",
        """When you add, you put groups together to find how many you have in all.

## Adding is putting together

If you have 3 apples and you get 2 more, you can count them all: 3, then 4, 5. Now you have 5 apples. We write this as 3 + 2 = 5.

A quick trick is to start with the bigger number and count on. For 2 + 6, start at 6 and count up two: 7, 8. So 2 + 6 = 8.

## Subtracting is taking away

When you subtract, you take some away and see what is left. If you have 7 grapes and you eat 3, you have 4 left. We write this as 7 - 3 = 4.

You can also count back. For 9 - 2, start at 9 and step back two: 8, 7. So 9 - 2 = 7.

## They are a team

Addition and subtraction are opposites. If 4 + 3 = 7, then 7 - 3 = 4. Knowing one helps you figure out the other.

## Remember

- Adding makes a group bigger; subtracting makes it smaller.
- Start with the bigger number and count on to add quickly.
- Count back to subtract.""",
    ),
    (
        "common_core", "fractions", 3, "What Is a Fraction?",
        """A fraction is a way to talk about a part of something whole.

## Equal parts

Imagine a pizza cut into 4 equal slices. Each slice is one part out of four, which we write as 1/4. If you eat 3 of those slices, you have eaten 3/4 of the pizza.

The most important word here is equal. The parts have to be the same size for a fraction to be fair.

## The top and bottom numbers

A fraction has two numbers:

- The bottom number tells you how many equal parts the whole is split into.
- The top number tells you how many of those parts you have.

So in 3/4, the 4 means four equal pieces, and the 3 means you have three of them.

## Same size, different names

Sometimes two fractions are the same amount. Half of a chocolate bar, 1/2, is the same as 2/4 if you cut it into four pieces and take two. These are called equivalent fractions.

## Remember

- A fraction shows part of a whole made of equal parts.
- The bottom number is how many pieces in all.
- The top number is how many pieces you have.""",
    ),
    (
        "common_core", "mult_div", 4, "Groups, Rows, and Sharing",
        """Multiplication and division help you work with equal groups quickly.

## Multiplication is equal groups

Instead of adding the same number over and over, you can multiply. If you have 3 bags with 4 marbles in each bag, that is 4 + 4 + 4, which is the same as 3 x 4 = 12.

It can help to picture rows. Three rows of four dots make an array, and counting them gives 12. That is why 3 x 4 and 4 x 3 both equal 12.

## Division is sharing or grouping

Division splits a number into equal groups. If you share 12 cookies among 4 friends, each friend gets 3, because 12 / 4 = 3.

You can also think of it as grouping: how many groups of 4 are in 12? The answer is 3.

## They undo each other

Multiplication and division are opposites, just like addition and subtraction. If 3 x 4 = 12, then 12 / 4 = 3 and 12 / 3 = 4. These three facts are a fact family.

## Remember

- Multiplying is adding equal groups fast.
- Dividing is splitting into equal groups.
- A fact family links one multiplication fact with two division facts.""",
    ),
]


def main() -> None:
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    curr = {c["code"]: c["id"] for c in sb.table("curricula").select("id, code").execute().data}
    topics = {t["code"]: t["id"] for t in sb.table("topics").select("id, code").execute().data}

    rows = []
    for ccode, tcode, grade, title, body in LESSONS:
        rows.append({
            "curriculum_id": curr[ccode],
            "topic_id": topics[tcode],
            "grade": grade,
            "title": title,
            "body": body,
            "status": "published",
        })
    sb.table("lessons").upsert(rows, on_conflict="curriculum_id,topic_id,grade").execute()
    print(f"seeded {len(rows)} published lessons")


if __name__ == "__main__":
    main()
