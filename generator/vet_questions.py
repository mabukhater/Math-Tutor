#!/usr/bin/env python3
"""Vetting review (M1): a human flips draft questions to vetted | retired.

The bot serves ONLY status='vetted'. Drafts are never shown to a child, so this
human gate is the safety boundary between AI output and the child-facing path.

Usage:
    export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
    python generator/vet_questions.py                 # review all drafts
    python generator/vet_questions.py --grade 3
    python generator/vet_questions.py --skill-code CCSS.3.NF.A.1
    python generator/vet_questions.py --stats          # counts by status, no review

Per question:  [v] vet   [r] retire   [s] skip   [q] quit
"""
from __future__ import annotations

import argparse
import os
import sys

try:
    from supabase import create_client
    from dotenv import load_dotenv
except ImportError as e:
    sys.exit(f"Missing dependency ({e}). Run: pip install -r generator/requirements.txt")

load_dotenv()

LETTERS = ["A", "B", "C", "D"]


def stats(sb) -> None:
    rows = sb.table("questions").select("status").execute().data
    counts: dict[str, int] = {}
    for r in rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    print("Question bank status:")
    for k in ("draft", "vetted", "retired"):
        print(f"  {k:8} {counts.get(k, 0)}")
    print(f"  {'total':8} {len(rows)}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--grade", type=int)
    ap.add_argument("--skill-code")
    ap.add_argument("--stats", action="store_true")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
    sb = create_client(url, key)

    if args.stats:
        stats(sb)
        return

    # Resolve skill filter -> skill_ids
    skill_ids = None
    if args.grade is not None or args.skill_code:
        sq = sb.table("skills").select("id, code")
        if args.grade is not None:
            sq = sq.eq("grade", args.grade)
        if args.skill_code:
            sq = sq.eq("code", args.skill_code)
        skill_rows = sq.execute().data
        skill_ids = [r["id"] for r in skill_rows]
        if not skill_ids:
            sys.exit("No matching skills.")

    dq = sb.table("questions").select(
        "id, skill_id, stem, options, correct_index, explanation, difficulty"
    ).eq("status", "draft")
    if skill_ids is not None:
        dq = dq.in_("skill_id", skill_ids)
    drafts = dq.execute().data

    if not drafts:
        print("No draft questions to review.")
        return

    # skill code lookup for display
    codes = {
        r["id"]: r["code"]
        for r in sb.table("skills").select("id, code").execute().data
    }

    print(f"{len(drafts)} draft question(s) to review.  [v]et  [r]etire  [s]kip  [q]uit\n")
    vetted = retired = skipped = 0

    for i, qrow in enumerate(drafts, 1):
        code = codes.get(qrow["skill_id"], "?")
        print(f"── {i}/{len(drafts)}  {code}  (difficulty {qrow['difficulty']})")
        print(f"   {qrow['stem']}")
        for j, opt in enumerate(qrow["options"]):
            mark = "✓" if j == qrow["correct_index"] else " "
            print(f"     {mark} {LETTERS[j]}. {opt}")
        print(f"   ⓘ {qrow['explanation']}")

        choice = ""
        while choice not in ("v", "r", "s", "q"):
            choice = input("   [v/r/s/q] > ").strip().lower()

        if choice == "q":
            break
        if choice == "s":
            skipped += 1
            print()
            continue
        new_status = "vetted" if choice == "v" else "retired"
        sb.table("questions").update({"status": new_status}).eq("id", qrow["id"]).execute()
        if choice == "v":
            vetted += 1
        else:
            retired += 1
        print()

    print(f"\nDone — {vetted} vetted, {retired} retired, {skipped} skipped.")
    print("(Remaining drafts stay 'draft' and can be reviewed later.)")


if __name__ == "__main__":
    main()
