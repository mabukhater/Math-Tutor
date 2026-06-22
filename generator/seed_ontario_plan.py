#!/usr/bin/env python3
"""Build the Ontario Grade-4 year plan: a Sept-June calendar of weeks, each
scheduling a math skill (focus) and, every few weeks, a reading passage. Tags
each math item with the Ontario expectation it covers (for the coverage view).

Idempotent: skips if the year plan already exists.

Usage:
    export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
    python generator/seed_ontario_plan.py
"""
from __future__ import annotations

import os
import sys
from datetime import date, timedelta

try:
    from supabase import create_client
    from dotenv import load_dotenv
except ImportError as e:
    sys.exit(f"Missing dependency ({e}). Run: pip install -r generator/requirements.txt")

load_dotenv()

YEAR_LABEL = "2025-26"
START = date(2025, 9, 2)   # first teaching day (after Labour Day 2025)
NUM_WEEKS = 36


def main() -> None:
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    cur = sb.table("curricula").select("id").eq("code", "ontario").single().execute().data["id"]

    existing = (
        sb.table("year_plans").select("id").eq("curriculum_id", cur).eq("grade", 4)
        .eq("year_label", YEAR_LABEL).execute().data
    )
    if existing:
        print("year plan already exists — nothing to do")
        return

    skills = (
        sb.table("skills").select("id, code, name").eq("curriculum_id", cur).eq("grade", 4)
        .order("sequence_position").execute().data
    )
    passages = (
        sb.table("passages").select("id, title").eq("grade", 4).eq("status", "published")
        .order("week").order("level_order").execute().data
    )
    if not skills:
        sys.exit("No Ontario Grade-4 skills — run seed_ontario_math.py first.")

    yp = sb.table("year_plans").insert({
        "curriculum_id": cur, "grade": 4, "year_label": YEAR_LABEL,
        "start_date": START.isoformat(), "num_weeks": NUM_WEEKS,
    }).execute().data[0]["id"]

    # Math: each skill is the focus for ~2 weeks, in order, filling the year.
    weeks_per_skill = max(1, NUM_WEEKS // len(skills))
    # Reading: spread the available passages evenly across the year.
    read_every = max(1, NUM_WEEKS // max(1, len(passages)))

    n_items = 0
    for w in range(1, NUM_WEEKS + 1):
        sk = skills[min((w - 1) // weeks_per_skill, len(skills) - 1)]
        wk = sb.table("plan_weeks").insert({
            "year_plan_id": yp, "week_no": w,
            "start_date": (START + timedelta(weeks=w - 1)).isoformat(),
            "title": sk["name"],
        }).execute().data[0]["id"]
        # math item
        exp = sk["code"].split(".")[-1]  # 'ON.4.B1.1' -> 'B1.1'
        sb.table("plan_items").insert({
            "plan_week_id": wk, "subject": "math", "kind": "math_skill",
            "ref_id": sk["id"], "title": sk["name"],
            "expectation_codes": [exp], "sort_order": 0,
        }).execute()
        n_items += 1
        # reading item every `read_every` weeks
        if passages and (w - 1) % read_every == 0:
            p = passages[min((w - 1) // read_every, len(passages) - 1)]
            sb.table("plan_items").insert({
                "plan_week_id": wk, "subject": "language", "kind": "reading_passage",
                "ref_id": p["id"], "title": p["title"], "sort_order": 1,
            }).execute()
            n_items += 1

    print(f"built year plan {YEAR_LABEL}: {NUM_WEEKS} weeks, {n_items} items "
          f"({len(skills)} math skills, {len(passages)} reading passages)")


if __name__ == "__main__":
    main()
