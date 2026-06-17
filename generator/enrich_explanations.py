#!/usr/bin/env python3
"""Add kid-friendly per-option explanations to existing vetted questions (offline).

For every option of a question, we generate a short, warm, kid-language note:
the correct option says why it's right; each wrong option names the common
mistake that leads a kid there and nudges toward the right idea. Stored in
questions.option_explanations (4 strings). Batched one API call per skill.

This is OFFLINE enrichment — never live AI to a child. Incremental: only fills
questions where option_explanations is null.

Usage:
    export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=...
    python generator/enrich_explanations.py --grade 3
    python generator/enrich_explanations.py --curriculum singapore
    python generator/enrich_explanations.py            # all skills
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


class QExpl(BaseModel):
    option_explanations: list[str]  # 4, in option order


class ExplSet(BaseModel):
    questions: list[QExpl]  # same order as input


SYSTEM = (
    "You are a warm, encouraging math teacher writing feedback for a child aged about "
    "{age} ({grade_label}, {curriculum}). For EACH question I give you, write a short, "
    "kid-friendly explanation for EVERY one of its 4 options, in the SAME order as the "
    "options.\n\n"
    "Rules for each explanation (1-2 short sentences, simple words, kind tone, no shaming):\n"
    "- For the CORRECT option: cheer briefly and explain in kid language WHY it's right and "
    "how to get there (a quick step or trick).\n"
    "- For a WRONG option: gently name the common mistake that makes a kid pick it (for "
    "example 'it looks like you added instead of multiplied' or 'you might have forgotten to "
    "carry the 1'), then point them toward the right idea.\n"
    "- Talk TO the child ('you'), stay positive, and keep it concrete.\n"
    "Return the explanations for all questions in order; each question needs exactly 4."
)


def build_user(qs: list[dict]) -> str:
    lines = []
    for i, q in enumerate(qs, 1):
        opts = "\n".join(f"    {chr(65+j)}. {o}" for j, o in enumerate(q["options"]))
        correct = chr(65 + q["correct_index"])
        lines.append(f"Q{i}: {q['stem']}\n{opts}\n  (correct answer: {correct})")
    return "Write per-option explanations for these questions:\n\n" + "\n\n".join(lines)


def valid(e: QExpl) -> Optional[str]:
    if len(e.option_explanations) != 4:
        return f"expected 4 explanations, got {len(e.option_explanations)}"
    if any(not s.strip() for s in e.option_explanations):
        return "empty explanation"
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--grade", type=int)
    ap.add_argument("--curriculum")
    ap.add_argument("--skill-code")
    ap.add_argument("--limit-skills", type=int)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY.")

    sb = create_client(url, key)
    client = anthropic.Anthropic()

    sq = sb.table("skills").select(
        "id, code, name, grade, curricula!inner(code, name, grade_noun, grade_offset)"
    ).order("sequence_position")
    if args.grade is not None:
        sq = sq.eq("grade", args.grade)
    if args.skill_code:
        sq = sq.eq("code", args.skill_code)
    if args.curriculum:
        sq = sq.eq("curricula.code", args.curriculum)
    skills = sq.execute().data
    if args.limit_skills:
        skills = skills[: args.limit_skills]

    total = 0
    for s in skills:
        try:
            qs = (
                sb.table("questions")
                .select("id, stem, options, correct_index")
                .eq("skill_id", s["id"])
                .eq("status", "vetted")
                .is_("option_explanations", "null")
                .execute()
                .data
            )
            if not qs:
                continue

            curr = s["curricula"]
            grade_label = f"{curr['grade_noun']} {s['grade'] + curr['grade_offset']}"
            system = SYSTEM.format(
                age=s["grade"] + 5, grade_label=grade_label, curriculum=curr["name"]
            )
            resp = client.messages.parse(
                model=args.model,
                max_tokens=8000,
                system=system,
                messages=[{"role": "user", "content": build_user(qs)}],
                output_format=ExplSet,
            )
            parsed = resp.parsed_output
            if parsed is None or len(parsed.questions) != len(qs):
                print(f"✗ {s['code']}: count mismatch ({parsed and len(parsed.questions)} vs {len(qs)})")
                continue

            updated = 0
            for q, e in zip(qs, parsed.questions):
                if valid(e):
                    continue
                if not args.dry_run:
                    sb.table("questions").update(
                        {"option_explanations": e.option_explanations}
                    ).eq("id", q["id"]).execute()
                updated += 1
            total += updated
            print(f"✓ {s['code']}: enriched {updated}/{len(qs)}")
        except Exception as ex:  # never let one skill abort the run
            print(f"✗ {s['code']}: error — {type(ex).__name__}: {ex}")
            continue

    print(f"\nDone. Enriched {total} questions.")


if __name__ == "__main__":
    main()
