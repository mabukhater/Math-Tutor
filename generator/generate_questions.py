#!/usr/bin/env python3
"""Offline question-bank generator (M1).

For each skill in the DB, asks the Anthropic API for N multiple-choice items and
inserts them as `status='draft'`. NOTHING here is ever served to a child — the
bot serves only `status='vetted'` (flip with vet_questions.py). This script must
never run in the child-facing request path.

Guardrails baked in:
  * Structured outputs (client.messages.parse + Pydantic) guarantee parseable
    JSON; we still hand-validate the constraints the JSON-schema layer can't
    express (exactly 4 options, correct_index in 0..3, difficulty in 1..5).
  * Invalid items are skipped with a logged reason, never inserted.

Usage:
    pip install -r generator/requirements.txt
    export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=...
    python generator/generate_questions.py                 # all skills, ~12 each
    python generator/generate_questions.py --grade 3       # only grade 3
    python generator/generate_questions.py --skill-code CCSS.3.NF.A.1
    python generator/generate_questions.py --target 15 --dry-run

Idempotent-ish: skips a skill that already has >= --target questions of any
status, so re-runs top up rather than duplicate. Use --force to generate anyway.
"""
from __future__ import annotations

import argparse
import os
import sys
from typing import Optional

from pydantic import BaseModel

try:
    import anthropic
    from supabase import create_client
    from dotenv import load_dotenv
except ImportError as e:
    sys.exit(f"Missing dependency ({e}). Run: pip install -r generator/requirements.txt")

load_dotenv()

DEFAULT_MODEL = os.environ.get("GENERATOR_MODEL", "claude-opus-4-8")


# --- Structured-output schema (numeric/length limits validated in Python) ----
class GeneratedQuestion(BaseModel):
    stem: str
    options: list[str]
    correct_index: int
    explanation: str
    difficulty: int


class QuestionSet(BaseModel):
    questions: list[GeneratedQuestion]


SYSTEM_TEMPLATE = (
    "You are a math curriculum specialist writing assessment items for US Common "
    "Core, grade {grade}, skill {code} — \"{name}\". Generate {n} multiple-choice "
    "questions for children aged about {age}.\n\n"
    "Rules:\n"
    "- Exactly 4 options each. Exactly one correct.\n"
    "- Distractors must reflect realistic mistakes (common misconceptions), not "
    "random numbers.\n"
    "- Vary difficulty across the set: tag each 1 (easy) to 5 (hard).\n"
    "- Age-appropriate language and context. Avoid reading-heavy word problems for "
    "the lower grades.\n"
    "- Provide a one-sentence explanation of the correct answer.\n"
    "- correct_index is the 0-based index into options of the correct choice."
)


def valid(q: GeneratedQuestion) -> Optional[str]:
    """Return a reason string if invalid, else None."""
    if len(q.options) != 4:
        return f"expected 4 options, got {len(q.options)}"
    if len({o.strip() for o in q.options}) != 4:
        return "options not distinct"
    if not 0 <= q.correct_index <= 3:
        return f"correct_index out of range: {q.correct_index}"
    if not 1 <= q.difficulty <= 5:
        return f"difficulty out of range: {q.difficulty}"
    if not q.stem.strip() or not q.explanation.strip():
        return "empty stem or explanation"
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", type=int, default=12, help="questions per skill (default 12)")
    ap.add_argument("--grade", type=int, help="restrict to one grade")
    ap.add_argument("--skill-code", help="restrict to a single skill code")
    ap.add_argument("--limit-skills", type=int, help="cap number of skills processed")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--force", action="store_true", help="generate even if skill already has enough")
    ap.add_argument("--dry-run", action="store_true", help="print, do not insert")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY.")

    sb = create_client(url, key)
    client = anthropic.Anthropic()

    q = sb.table("skills").select("id, code, name, grade, domain").order("sequence_position")
    if args.grade is not None:
        q = q.eq("grade", args.grade)
    if args.skill_code:
        q = q.eq("code", args.skill_code)
    skills = q.execute().data
    if args.limit_skills:
        skills = skills[: args.limit_skills]
    if not skills:
        sys.exit("No matching skills. Seed the ladder first (seed_skills.py).")

    total_inserted = 0
    for s in skills:
        if not args.force:
            existing = (
                sb.table("questions").select("id", count="exact").eq("skill_id", s["id"]).execute()
            )
            have = existing.count or 0
            if have >= args.target:
                print(f"· {s['code']}: already has {have} — skipping")
                continue

        age = s["grade"] + 5
        system = SYSTEM_TEMPLATE.format(
            grade=s["grade"], code=s["code"], name=s["name"], n=args.target, age=age
        )
        try:
            resp = client.messages.parse(
                model=args.model,
                max_tokens=8000,
                system=system,
                messages=[{"role": "user", "content": f"Generate {args.target} questions now."}],
                output_format=QuestionSet,
            )
        except anthropic.APIError as e:
            print(f"✗ {s['code']}: API error — {e}")
            continue

        parsed = resp.parsed_output
        if parsed is None:
            print(f"✗ {s['code']}: no parseable output (stop_reason={resp.stop_reason})")
            continue

        rows, skipped = [], 0
        for item in parsed.questions:
            reason = valid(item)
            if reason:
                skipped += 1
                print(f"    skip ({reason})")
                continue
            rows.append(
                {
                    "skill_id": s["id"],
                    "stem": item.stem.strip(),
                    "options": item.options,
                    "correct_index": item.correct_index,
                    "explanation": item.explanation.strip(),
                    "difficulty": item.difficulty,
                    "status": "draft",
                    "source": "ai_generated",
                }
            )

        if args.dry_run:
            print(f"  {s['code']}: would insert {len(rows)} ({skipped} skipped)")
            continue

        if rows:
            sb.table("questions").insert(rows).execute()
            total_inserted += len(rows)
        print(f"✓ {s['code']}: inserted {len(rows)} draft ({skipped} skipped)")

    print(f"\nDone. {total_inserted} draft questions inserted. "
          f"Vet them with: python generator/vet_questions.py")


if __name__ == "__main__":
    main()
