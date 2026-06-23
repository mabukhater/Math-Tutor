#!/usr/bin/env python3
"""Generate reading passages on EXPLICIT, diverse topics so a grade's reading
ladder isn't all bees and butterflies. Each passage is forced onto a distinct
topic spanning animals, ocean life, space, people/history, places, invention,
everyday life, and fiction.

Reuses the leveling + question shape of generate_passages.py. With --replace it
retires the grade's current published passages first, so the ladder is fully
refreshed with varied topics.

Usage:
    export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=...
    python generator/generate_diverse_passages.py --grade 4 --replace
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

# A deliberately broad spread — no two from the same lane back to back when shuffled.
TOPICS = [
    "a loyal sled dog racing through the snow",
    "how an octopus changes color to hide",
    "why bats sleep hanging upside down",
    "a mother penguin keeping her chick warm",
    "the cheetah, the fastest runner on land",
    "how beavers build their dams",
    "the glowing fish of the deep dark sea",
    "a sea turtle's long journey back to its beach",
    "the busy, colorful world of a coral reef",
    "how a colony of ants works together",
    "the blinking lights of fireflies at night",
    "the giant rings around the planet Saturn",
    "the first people to walk on the Moon",
    "why the stars seem to twinkle at night",
    "a young girl who loved to invent gadgets",
    "the workers who built a great stone bridge",
    "an explorer who mapped an unknown coast",
    "a busy morning market in a faraway city",
    "the giant canyon a river carved over time",
    "a city built on water where boats are cars",
    "a small robot who wanted to learn to paint",
    "the secret door hidden behind the library shelf",
    "a kite that flew higher than the clouds",
    "a lost cat who found its way home",
    "the new kid who joined the class",
    "baking bread with Grandpa on a rainy day",
    "two friends who built a backyard fort",
    "where rain comes from and why it falls",
    "how gears help a bicycle go fast",
    "why leaves change color in autumn",
    "the big game and the last-minute winning goal",
    "a boy learning to play the drums",
    "a curious fox exploring a sleeping town at night",
    "the lighthouse keeper and the stormy sea",
]


class RQ(BaseModel):
    qtype: str
    stem: str
    options: list[str]
    correct_index: int
    explanation: str
    locator_paragraph: int
    locator_hint: str


class Passage(BaseModel):
    title: str
    paragraphs: list[str]
    questions: list[RQ]


SYSTEM = (
    "You write original, age-appropriate reading passages and comprehension "
    "questions for a child about age {age} (grade {grade}).\n\n"
    "THE TOPIC OF THIS PASSAGE IS FIXED: {topic}. Write specifically and only about "
    "this topic — do not drift to bees, butterflies, or migration.\n\n"
    "READING LEVEL — match it tightly:\n{level_guidance}\n\n"
    "This is WEEK {week}; later weeks are a little longer and harder but never above "
    "the grade's reading level.\n\n"
    "Produce:\n"
    "- A specific, inviting title (not generic) and {paras}, in order.\n"
    "- Exactly 10 multiple-choice questions: a mix of main_idea, detail, inference, "
    "vocab, sequence, at the passage's reading level.\n"
    "- Each question: 4 options, one correct (correct_index 0-3), a one-sentence "
    "kid-friendly explanation, the 1-based locator_paragraph holding the answer, and a "
    "locator_hint that points back to that paragraph without giving the answer away.\n"
    "Make distractors plausible but clearly wrong on a careful read."
)

QTYPE_DIFF = {"detail": 1, "main_idea": 2, "sequence": 2, "vocab": 3, "inference": 4}


def q_difficulty(qtype: str, grade: int) -> int:
    return max(1, min(5, QTYPE_DIFF.get(qtype, 2) + (1 if grade >= 5 else 0)))


def level_spec(grade: int) -> tuple[str, str]:
    if grade <= 1:
        return (
            "Grade 1 (age ~6): VERY simple. Sentences of 3 to 7 words, common sight words, "
            "easy decodable words. One simple idea per sentence. No fancy words.",
            "3 short paragraphs of 2 to 3 very short sentences",
        )
    if grade == 2:
        return (
            "Grade 2 (age ~7): simple. Sentences of 5 to 10 words, mostly familiar words.",
            "3 to 4 short paragraphs of 2 to 3 sentences",
        )
    if grade <= 4:
        return (
            f"Grade {grade} (age ~{grade + 5}): sentences of 8 to 14 words, grade vocabulary "
            "with some richer words made clear by context.",
            "4 to 5 paragraphs of 2 to 4 sentences",
        )
    return (
        f"Grade {grade} (age ~{grade + 5}): longer varied sentences, richer vocabulary, more "
        "inference, still clear and age-appropriate.",
        "5 to 6 paragraphs of 3 to 4 sentences",
    )


def valid(p: Passage) -> str | None:
    if not p.title.strip() or not (2 <= len(p.paragraphs) <= 6):
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
    ap.add_argument("--weeks", type=int, default=4)
    ap.add_argument("--per-week", type=int, default=3)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--replace", action="store_true", help="retire the grade's current published passages first")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
    if not args.dry_run and not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY.")
    sb = create_client(url, key)

    n = args.weeks * args.per_week
    if n > len(TOPICS):
        sys.exit(f"Need {n} topics but only {len(TOPICS)} defined.")
    # Distinct topics for this grade (vary by grade so siblings don't get identical sets).
    pool = TOPICS[:]
    random.Random(args.grade * 97 + 13).shuffle(pool)
    chosen = pool[:n]

    print(f"grade {args.grade}: {n} diverse passages ({args.weeks} weeks x {args.per_week})"
          + (" [dry run]" if args.dry_run else ""))
    for i, t in enumerate(chosen):
        print(f"  week {i // args.per_week + 1}: {t}")
    if args.dry_run:
        return

    client = anthropic.Anthropic(max_retries=5)

    if args.replace:
        old = sb.table("passages").select("id").eq("grade", args.grade).eq("status", "published").execute().data
        ids = [r["id"] for r in old]
        if ids:
            sb.table("reading_questions").update({"status": "retired"}).in_("passage_id", ids).execute()
            sb.table("passages").update({"status": "retired"}).in_("id", ids).execute()
            print(f"retired {len(ids)} old passages + their questions")

    existing = sb.table("passages").select("level_order").eq("grade", args.grade).execute().data
    order = (max((r["level_order"] for r in existing), default=0)) + 1

    made = 0
    for i, topic in enumerate(chosen):
        week = i // args.per_week + 1
        guidance, paras = level_spec(args.grade)
        system = SYSTEM.format(age=args.grade + 5, grade=args.grade, week=week, topic=topic,
                               level_guidance=guidance, paras=paras)
        try:
            resp = client.messages.parse(
                model=args.model, max_tokens=4500, system=system,
                messages=[{"role": "user", "content": f"Write the passage about: {topic}"}],
                output_format=Passage,
            )
            p = resp.parsed_output
            err = valid(p) if p else "no output"
            if err:
                print(f"✗ {topic[:40]}: {err}")
                continue
            paragraphs = [{"n": j + 1, "text": t.strip()} for j, t in enumerate(p.paragraphs)]
            wc = sum(len(t.split()) for t in p.paragraphs)
            pid = sb.table("passages").insert({
                "grade": args.grade, "week": week, "level_order": order, "title": p.title.strip(),
                "paragraphs": paragraphs, "word_count": wc, "status": "published",
            }).execute().data[0]["id"]
            order += 1
            rows = []
            for q in p.questions:
                shuffled = q.options[:]
                random.shuffle(shuffled)
                rows.append({
                    "passage_id": pid, "stem": q.stem.strip(), "options": shuffled,
                    "correct_index": shuffled.index(q.options[q.correct_index]),
                    "explanation": q.explanation.strip(),
                    "locator": {"paragraph": q.locator_paragraph, "hint": q.locator_hint.strip()},
                    "qtype": q.qtype, "difficulty": q_difficulty(q.qtype, args.grade),
                    "status": "vetted",
                })
            sb.table("reading_questions").insert(rows).execute()
            made += 1
            print(f"✓ w{week} \"{p.title.strip()}\"  [{topic[:34]}]")
        except Exception as e:  # noqa: BLE001
            print(f"✗ {topic[:40]}: {type(e).__name__}: {e}")

    print(f"\nDone. Generated {made} diverse passages for grade {args.grade}.")


if __name__ == "__main__":
    main()
