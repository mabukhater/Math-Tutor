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
import random
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
    option_explanations: list[str]  # kid-friendly note per option, in order


class QuestionSet(BaseModel):
    questions: list[GeneratedQuestion]


CURRICULUM_PROFILES = {
    "singapore": (
        "SINGAPORE MATH (MOE syllabus) — make it unmistakably Singapore:\n"
        "- Use the BAR-MODEL / model-drawing method for word problems (part-whole and comparison bars), "
        "and NUMBER BONDS for part-whole relationships, with the 'make-ten' and branching strategies.\n"
        "- Follow Concrete -> Pictorial -> Abstract; favour mastery and mental-math heuristics.\n"
        "- Currency: Singapore dollars and cents ($, ¢). Units: metric (cm, m, kg, g, litres, ml).\n"
        "- Several word problems should be naturally solved by drawing a bar model; mention the model in "
        "the explanation."
    ),
    "uk_national": (
        "UK NATIONAL CURRICULUM (England) — make it unmistakably British:\n"
        "- Currency: pounds and pence (£, p), e.g. £3.45, 75p. Metric units and BRITISH spelling: "
        "centimetres, metres, kilograms, litres, 'maths', 'colour', 'centre', 'favourite'.\n"
        "- Use the FORMAL WRITTEN METHODS taught in England: column addition/subtraction with carrying/"
        "exchanging, short & long multiplication, and the BUS-STOP method (short division) for division.\n"
        "- Emphasise times-table fluency (to 12×12), fractions, and reasoning/'prove it' problem solving.\n"
        "- British contexts: the corner shop, a bus fare, the playground, a school fete."
    ),
    "ontario": (
        "ONTARIO 2020 CURRICULUM — make it unmistakably Ontario/Canadian:\n"
        "- Currency: Canadian dollars and cents ($, ¢). Metric units. Canadian spelling (colour, metre, centre).\n"
        "- Reflect Ontario's strands, especially FINANCIAL LITERACY (money sense, making change, simple budgets, "
        "needs vs wants) and ALGEBRA (patterns, and simple coding / step-by-step instructions where natural).\n"
        "- Emphasise multiple representations and explaining your thinking."
    ),
    "common_core": (
        "US COMMON CORE — keep US conventions:\n"
        "- Currency: US dollars and cents ($, ¢). US spelling (math, color, meter). US customary and metric as fits.\n"
        "- Emphasise conceptual understanding and multiple strategies/representations: area models, number lines, "
        "place-value decomposition, and 'explain your reasoning' (Standards for Mathematical Practice)."
    ),
}


def profile_for(code: str) -> str:
    return CURRICULUM_PROFILES.get(
        code, "Use this curriculum's authentic conventions, methods, terminology, currency, and units."
    )


SYSTEM_TEMPLATE = (
    "You are a math curriculum specialist writing assessment items for the "
    "{curriculum}, {grade_label}, skill {code} — \"{name}\". Generate {n} "
    "multiple-choice questions for children aged about {age}.\n\n"
    "CURRICULUM METHOD & CONVENTIONS — this defines HOW this curriculum teaches; follow it "
    "exactly so the questions are authentic to it, not generic:\n{method_profile}\n\n"
    "Rules:\n"
    "- Use the methods, question types, currency, units, and spelling from the CURRICULUM METHOD & "
    "CONVENTIONS above. The same skill should look different across curricula — a UK child sees £ and "
    "bus-stop division, a Singapore child sees bar models and number bonds.\n"
    "- Exactly 4 options each. Exactly one correct.\n"
    "- Distractors must reflect realistic mistakes (common misconceptions), not "
    "random numbers.\n"
    "- Vary difficulty across the set: tag each 1 (easy) to 5 (hard).\n"
    "- Age-appropriate language and context. Avoid reading-heavy word problems for "
    "the lower grades.\n"
    "- Provide a one-sentence explanation of the correct answer.\n"
    "- correct_index is the 0-based index into options of the correct choice.\n"
    "- option_explanations: a warm, kid-friendly note (1-2 short sentences) for EACH of "
    "the 4 options IN ORDER. For the correct option, why it's right and how to get there. "
    "For each wrong option, gently name the common mistake that leads a kid to pick it "
    "(e.g. 'it looks like you added instead of multiplied') and nudge toward the right idea. "
    "Talk to the child as 'you', stay positive, no shaming."
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
    if len(q.option_explanations) != 4 or any(not s.strip() for s in q.option_explanations):
        return "option_explanations must have 4 non-empty entries"
    return None


def shuffle_options(item: GeneratedQuestion) -> tuple[list[str], list[str], int]:
    """Randomize the answer position. LLMs strongly bias the correct answer to
    A/B, which lets a child pass by always picking A. Apply ONE permutation to
    both options and option_explanations (so each option keeps its own note) and
    recompute correct_index. Mirrors the reading generator's fix (e752049)."""
    order = list(range(4))
    random.shuffle(order)
    options = [item.options[i] for i in order]
    option_explanations = [item.option_explanations[i] for i in order]
    correct_index = order.index(item.correct_index)
    return options, option_explanations, correct_index


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", type=int, default=12, help="questions per skill (default 12)")
    ap.add_argument("--grade", type=int, help="restrict to one grade")
    ap.add_argument("--skill-code", help="restrict to a single skill code")
    ap.add_argument("--limit-skills", type=int, help="cap number of skills processed")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--curriculum", help="restrict to one curriculum code (e.g. uk_national, singapore)")
    ap.add_argument("--source", default="ai_generated", help="source tag for inserted rows")
    ap.add_argument("--isolate", action="store_true", help="incremental skip counts only --source rows (for regen)")
    ap.add_argument("--topup", action="store_true", help="generate only (target - have) to reach target, not a full batch")
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
    client = anthropic.Anthropic(max_retries=6)  # ride out transient 429/529

    q = sb.table("skills").select(
        "id, code, name, grade, domain, curricula!inner(code, name, grade_noun, grade_offset)"
    ).order("sequence_position")
    if args.grade is not None:
        q = q.eq("grade", args.grade)
    if args.skill_code:
        q = q.eq("code", args.skill_code)
    if args.curriculum:
        q = q.eq("curricula.code", args.curriculum)
    skills = q.execute().data
    if args.limit_skills:
        skills = skills[: args.limit_skills]
    if not skills:
        print("No matching skills for this curriculum/grade — nothing to do.")
        return

    total_inserted = 0
    for s in skills:
        # Wrap the ENTIRE per-skill body: a failure in the count query, the API
        # call, validation, or the insert must never abort the whole run.
        try:
            have = 0
            if not args.force or args.topup:
                cnt = (
                    sb.table("questions").select("id", count="exact")
                    .eq("skill_id", s["id"]).in_("status", ["draft", "vetted"])
                )
                if args.isolate:  # count only this source (for curriculum regen)
                    cnt = cnt.eq("source", args.source)
                have = cnt.execute().count or 0
                if not args.force and have >= args.target:
                    print(f"· {s['code']}: already has {have} — skipping")
                    continue

            # --topup generates only the deficit (target - have); default = full batch.
            n_gen = max(1, args.target - have) if args.topup else args.target
            age = s["grade"] + 5
            curr = s["curricula"]
            grade_label = f"{curr['grade_noun']} {s['grade'] + curr['grade_offset']}"
            system = SYSTEM_TEMPLATE.format(
                curriculum=curr["name"], grade_label=grade_label,
                code=s["code"], name=s["name"], n=n_gen, age=age,
                method_profile=profile_for(curr["code"]),
            )
            resp = client.messages.parse(
                model=args.model,
                max_tokens=8000,
                system=system,
                messages=[{"role": "user", "content": f"Generate {n_gen} questions now."}],
                output_format=QuestionSet,
            )
            parsed = resp.parsed_output
            if parsed is None:
                print(f"✗ {s['code']}: no parseable output (stop_reason={resp.stop_reason})")
                continue

            rows, skipped = [], 0
            for item in parsed.questions:
                reason = valid(item)
                if reason:
                    skipped += 1
                    continue
                options, option_explanations, correct_index = shuffle_options(item)
                rows.append(
                    {
                        "skill_id": s["id"],
                        "stem": item.stem.strip(),
                        "options": options,
                        "correct_index": correct_index,
                        "explanation": item.explanation.strip(),
                        "difficulty": item.difficulty,
                        "option_explanations": option_explanations,
                        "status": "draft",
                        "source": args.source,
                    }
                )

            if args.dry_run:
                print(f"  {s['code']}: would insert {len(rows)} ({skipped} skipped)")
                continue
            if rows:
                sb.table("questions").insert(rows).execute()
                total_inserted += len(rows)
            print(f"✓ {s['code']}: inserted {len(rows)} draft ({skipped} skipped)")
        except Exception as e:
            print(f"✗ {s['code']}: error — {type(e).__name__}: {e}")
            continue

    print(f"\nDone. {total_inserted} draft questions inserted. "
          f"Vet them with: python generator/vet_questions.py")


if __name__ == "__main__":
    main()
