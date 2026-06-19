#!/usr/bin/env python3
"""Generate a per-SKILL weekly lesson for the learning path (lessons.skill_id).
Each path week gets its own short lesson about that specific skill, instead of
falling back to the shared topic month-intro.

Offline + vetted, structured output, incremental (skips skills that already
have a skill-level lesson). Markdown the renderer supports: "## " headings,
blank-line paragraphs, "- " bullets only.

Usage:
    export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=...
    python generator/generate_skill_lessons.py --dry-run
    python generator/generate_skill_lessons.py --grade 3
    python generator/generate_skill_lessons.py            # all path skills
"""
from __future__ import annotations

import argparse
import os
import sys

from pydantic import BaseModel

try:
    import anthropic
    from supabase import create_client
    from dotenv import load_dotenv
except ImportError as e:
    sys.exit(f"Missing dependency ({e}). Run: pip install -r generator/requirements.txt")

load_dotenv()
DEFAULT_MODEL = os.environ.get("GENERATOR_MODEL", "claude-opus-4-8")


class LessonOut(BaseModel):
    title: str
    body: str


SYSTEM = (
    "You are a warm, encouraging teacher writing a short lesson for a child about "
    "age {age} ({grade_label}, {curriculum}). The child reads this BEFORE practicing "
    "this week's specific skill: \"{skill}\" (topic: {topic}).\n\n"
    "Rules:\n"
    "- 140 to 260 words, focused ONLY on this week's skill.\n"
    "- Use ONLY this markdown: \"## \" headings, blank-line paragraphs, and \"- \" bullet "
    "lists. No bold, italics, links, tables, images, or numbered lists.\n"
    "- Open with ONE friendly sentence (no heading), then 2 \"## \" sections with a concrete "
    "example a child relates to, then a \"## Remember\" section that is a \"- \" bullet list of "
    "2 to 4 takeaways.\n"
    "- Simple words, talk to the child as \"you\", stay within this grade. No quiz answers.\n"
    "The title is 3 to 6 plain words."
)


def valid(le: LessonOut) -> str | None:
    if not le.title.strip():
        return "empty title"
    b = le.body.strip()
    if len(b) < 110 or "## " not in b or ("\n- " not in b and not b.startswith("- ")):
        return "malformed body"
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--grade", type=int)
    ap.add_argument("--curriculum")
    ap.add_argument("--limit", type=int)
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

    topics = {t["id"]: t for t in sb.table("topics").select("id, name").execute().data}
    sq = sb.table("skills").select(
        "id, name, grade, topic_id, curriculum_id, curricula!inner(code, name, grade_noun, grade_offset)"
    ).not_.is_("topic_id", "null").order("sequence_position")
    if args.grade is not None:
        sq = sq.eq("grade", args.grade)
    if args.curriculum:
        sq = sq.eq("curricula.code", args.curriculum)
    skills = sq.execute().data

    # Skip skills that already have a skill-level lesson.
    existing = sb.table("lessons").select("skill_id").not_.is_("skill_id", "null").execute().data
    done = {r["skill_id"] for r in existing}
    todo = [s for s in skills if s["id"] not in done]
    if args.limit:
        todo = todo[: args.limit]

    print(f"{len(todo)} skill lessons to generate" + (" (dry run)" if args.dry_run else ""))

    made = 0
    for s in todo:
        curr = s["curricula"]
        grade_label = f"{curr['grade_noun']} {s['grade'] + curr['grade_offset']}"
        topic = topics.get(s["topic_id"], {}).get("name", "")
        tag = f"{curr['code']} {grade_label} · {s['name'][:40]}"
        if args.dry_run:
            print(f"  would generate: {tag}")
            continue
        try:
            system = SYSTEM.format(
                age=s["grade"] + 5, grade_label=grade_label,
                curriculum=curr["name"], skill=s["name"], topic=topic,
            )
            resp = client.messages.parse(
                model=args.model, max_tokens=1800, system=system,
                messages=[{"role": "user", "content": f"Write the lesson for: {s['name']}"}],
                output_format=LessonOut,
            )
            le = resp.parsed_output
            err = valid(le) if le else "no output"
            if err:
                print(f"✗ {tag}: {err}")
                continue
            sb.table("lessons").insert({
                "curriculum_id": s["curriculum_id"],
                "topic_id": s["topic_id"], "grade": s["grade"],
                "skill_id": s["id"], "title": le.title.strip(), "body": le.body.strip(),
                "status": "draft" if args.draft else "published",
            }).execute()
            made += 1
            print(f"✓ {tag} — \"{le.title.strip()}\"")
        except Exception as e:  # noqa: BLE001
            print(f"✗ {tag}: error — {type(e).__name__}: {e}")

    print(f"\nDone. Generated {made} skill lessons.")


if __name__ == "__main__":
    main()
