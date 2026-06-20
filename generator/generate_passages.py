#!/usr/bin/env python3
"""Generate leveled reading passages + comprehension questions with paragraph
locators (offline, vetted). One API call per passage, structured output.

Each passage is age/grade-appropriate, 3-5 short numbered paragraphs, with 5
multiple-choice questions (main idea, detail, inference, vocabulary, sequence),
each tagged with the paragraph that holds the answer and a kid-friendly hint.

Usage:
    export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=...
    python generator/generate_passages.py --grade 3 --count 4 --dry-run
    python generator/generate_passages.py --grade 3 --count 4
"""
from __future__ import annotations

import argparse
import os
import random
import sys

from pydantic import BaseModel

try:
    import anthropic
    from supabase import create_client
    from dotenv import load_dotenv
except ImportError as e:
    sys.exit(f"Missing dependency ({e}). Run: pip install -r generator/requirements.txt")

load_dotenv()
DEFAULT_MODEL = os.environ.get("GENERATOR_MODEL", "claude-sonnet-4-6")


class RQ(BaseModel):
    qtype: str            # main_idea | detail | inference | vocab | sequence
    stem: str
    options: list[str]    # exactly 4
    correct_index: int    # 0-3
    explanation: str
    locator_paragraph: int
    locator_hint: str


class Passage(BaseModel):
    title: str
    paragraphs: list[str]  # 3-5 short paragraphs, in order
    questions: list[RQ]    # exactly 5


SYSTEM = (
    "You write original, age-appropriate reading passages and comprehension "
    "questions for a child about age {age} (grade {grade}). Reading level must "
    "match the grade — sentence length and vocabulary appropriate for a {grade}th "
    "grader.\n\n"
    "This passage is for WEEK {week} — passages get a little longer and harder each "
    "week, so make it suitably rich for week {week}.\n\n"
    "Produce:\n"
    "- A short story or informational passage: a title and 4 to 6 SHORT paragraphs "
    "(2-4 sentences each), in order. Wholesome, engaging, varied topics.\n"
    "- Exactly 10 multiple-choice questions about the passage, covering a mix of: "
    "main_idea, detail, inference, vocab, sequence.\n"
    "- Each question: 4 options, one correct (correct_index 0-3), a one-sentence "
    "kid-friendly explanation, the 1-based paragraph number that holds the answer "
    "(locator_paragraph), and a short locator_hint that points the child back to "
    "that paragraph WITHOUT giving the answer away (e.g. 'Re-read ¶2 — it tells you "
    "where they went').\n"
    "Make distractors plausible but clearly wrong on a careful read. Difficulty must "
    "fit grade {grade}."
)


def valid(p: Passage) -> str | None:
    if not p.title.strip() or not (3 <= len(p.paragraphs) <= 6):
        return "bad passage shape"
    if len(p.questions) != 10:
        return f"expected 10 questions, got {len(p.questions)}"
    for q in p.questions:
        if len(q.options) != 4 or not (0 <= q.correct_index <= 3):
            return "bad options"
        if not (1 <= q.locator_paragraph <= len(p.paragraphs)):
            return "locator out of range"
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--grade", type=int, required=True)
    ap.add_argument("--week", type=int, help="week number (default: next empty week for the grade)")
    ap.add_argument("--count", type=int, default=3, help="passages to generate (3-4 per week)")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--draft", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
    if not args.dry_run and not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY.")

    sb = create_client(url, key)
    client = anthropic.Anthropic() if not args.dry_run else None

    # Continue numbering after existing passages at this grade.
    existing = sb.table("passages").select("level_order, week").eq("grade", args.grade).execute().data
    next_order = (max((r["level_order"] for r in existing), default=0)) + 1
    week = args.week if args.week is not None else (max((r["week"] for r in existing), default=0)) + 1

    print(f"generating {args.count} passages for grade {args.grade}, week {week} "
          f"(levels {next_order}..{next_order + args.count - 1})"
          + (" (dry run)" if args.dry_run else ""))
    if args.dry_run:
        return

    system = SYSTEM.format(age=args.grade + 5, grade=args.grade, week=week)
    made = 0
    for k in range(args.count):
        order = next_order + k
        try:
            resp = client.messages.parse(
                model=args.model, max_tokens=4500, system=system,
                messages=[{
                    "role": "user",
                    "content": f"Write reading passage #{k + 1} of {args.count} for grade "
                               f"{args.grade}, week {week}. Make it different in topic and style "
                               f"from the others in this week.",
                }],
                output_format=Passage,
            )
            p = resp.parsed_output
            err = valid(p) if p else "no output"
            if err:
                print(f"✗ level {order}: {err}")
                continue
            paragraphs = [{"n": i + 1, "text": t.strip()} for i, t in enumerate(p.paragraphs)]
            wc = sum(len(t.split()) for t in p.paragraphs)
            pid = sb.table("passages").insert({
                "grade": args.grade, "week": week, "level_order": order, "title": p.title.strip(),
                "paragraphs": paragraphs, "word_count": wc,
                "status": "draft" if args.draft else "published",
            }).execute().data[0]["id"]
            rows = []
            for q in p.questions:
                shuffled = q.options[:]
                random.shuffle(shuffled)  # spread the correct answer across positions
                rows.append({
                    "passage_id": pid, "stem": q.stem.strip(), "options": shuffled,
                    "correct_index": shuffled.index(q.options[q.correct_index]),
                    "explanation": q.explanation.strip(),
                    "locator": {"paragraph": q.locator_paragraph, "hint": q.locator_hint.strip()},
                    "qtype": q.qtype, "status": "vetted",
                })
            sb.table("reading_questions").insert(rows).execute()
            made += 1
            print(f"✓ level {order} — \"{p.title.strip()}\" ({len(rows)} questions)")
        except Exception as e:  # noqa: BLE001
            print(f"✗ level {order}: error — {type(e).__name__}: {e}")

    print(f"\nDone. Generated {made} passages.")


if __name__ == "__main__":
    main()
