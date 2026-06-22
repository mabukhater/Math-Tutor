#!/usr/bin/env python3
"""Seed the Ontario Grade-4 math curriculum: skills (mapped to topics) + the
Ontario expectations they cover. Questions are generated separately with
generate_questions.py --curriculum ontario --grade 4.

Usage:
    export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
    python generator/seed_ontario_math.py
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

# (expectation_code, strand, name, topic_code) — Ontario 2020 Grade-4 math.
SKILLS = [
    ("B1.1", "B. Number", "Read and represent whole numbers up to 10 000", "numbers"),
    ("B1.2", "B. Number", "Compare and order whole numbers up to 10 000", "numbers"),
    ("B1.3", "B. Number", "Round whole numbers to the nearest 10, 100, or 1000", "numbers"),
    ("B1.4", "B. Number", "Represent and compare fractions", "fractions"),
    ("B1.6", "B. Number", "Represent and read decimal tenths", "decimals"),
    ("B2.2", "B. Number", "Recall multiplication and division facts to 10 x 10", "mult_div"),
    ("B2.3", "B. Number", "Add and subtract multi-digit whole numbers", "add_sub"),
    ("B2.4", "B. Number", "Multiply two-digit by one-digit and two-digit numbers", "mult_div"),
    ("B2.5", "B. Number", "Divide whole numbers by one-digit divisors", "mult_div"),
    ("B2.7", "B. Number", "Add and subtract fractions with like denominators", "fractions"),
    ("C1.1", "C. Algebra", "Identify and extend number and shape patterns", "algebra"),
    ("C2.2", "C. Algebra", "Determine the unknown number in an equation", "algebra"),
    ("D1.3", "D. Data", "Construct and read pictographs and bar graphs", "data"),
    ("D2.1", "D. Data", "Describe the likelihood of events", "data"),
    ("E1.1", "E. Spatial Sense", "Identify angles and properties of 2-D shapes", "geometry"),
    ("E2.4", "E. Spatial Sense", "Find the area and perimeter of rectangles", "geometry"),
    ("E2.1", "E. Spatial Sense", "Measure length, mass, and capacity with units", "measurement"),
    ("F1.1", "F. Financial Literacy", "Estimate and calculate costs and make change", "money"),
]


def main() -> None:
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    cur = sb.table("curricula").select("id").eq("code", "ontario").single().execute().data["id"]
    topics = {t["code"]: t["id"] for t in sb.table("topics").select("id, code").execute().data}

    made_s = made_e = 0
    for i, (code, strand, name, topic) in enumerate(SKILLS, start=1):
        skill_code = f"ON.4.{code}"
        existing = sb.table("skills").select("id").eq("curriculum_id", cur).eq("code", skill_code).execute().data
        if not existing:
            sb.table("skills").insert({
                "curriculum_id": cur, "code": skill_code, "name": name,
                "domain": strand, "grade": 4, "sequence_position": i,
                "topic_id": topics.get(topic), "prerequisite_ids": [],
            }).execute()
            made_s += 1
        # expectation row
        ex = sb.table("expectations").select("id").eq("curriculum_id", cur).eq("grade", 4).eq("subject", "math").eq("code", code).execute().data
        if not ex:
            sb.table("expectations").insert({
                "curriculum_id": cur, "grade": 4, "subject": "math",
                "strand": strand, "code": code, "description": name, "sort_order": i,
            }).execute()
            made_e += 1
        print(f"  {skill_code} [{topic}] — {name}")

    print(f"\nseeded {made_s} skills, {made_e} expectations for Ontario Grade 4 math")


if __name__ == "__main__":
    main()
