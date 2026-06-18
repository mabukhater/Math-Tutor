#!/usr/bin/env python3
"""Generate short, kid-friendly "learn before you practice" lessons for every
(curriculum, topic, grade) that has practiceable questions but no lesson yet.

Offline + vetted: never live AI to a child. One API call per lesson, structured
output via messages.parse + Pydantic. Incremental — skips units that already
have a published lesson.

Markdown the web renderer supports (and the model MUST stick to): "## " section
headings, blank-line paragraphs, and "- " bullet lists. No bold/italic/links.

Usage:
    export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=...
    python generator/generate_lessons.py --dry-run
    python generator/generate_lessons.py --curriculum common_core --grade 3
    python generator/generate_lessons.py            # all units
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict

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
    body: str  # markdown: ## headings, paragraphs, "- " bullets only


SYSTEM = (
    "You are a warm, encouraging teacher writing a short lesson for a child about "
    "age {age} ({grade_label}, {curriculum}) on the topic \"{topic}\". The child reads "
    "this BEFORE they practice, to learn the idea.\n\n"
    "Rules:\n"
    "- 150 to 280 words.\n"
    "- Use ONLY this markdown: \"## \" section headings, blank-line-separated paragraphs, "
    "and \"- \" bullet lists. Do NOT use bold, italics, links, tables, images, or numbered lists.\n"
    "- Open with ONE friendly sentence introducing the idea (no heading), then 2 or 3 \"## \" "
    "sections, each with a simple example a child relates to (snacks, toys, sharing, steps).\n"
    "- End with a \"## Remember\" section that is a \"- \" bullet list of 2 to 4 key takeaways.\n"
    "- Use simple words and talk to the child as \"you\". Be concrete. Stay within what this "
    "grade actually learns.\n"
    "- Do NOT reference any specific quiz question or answer.\n"
    "The title is 3 to 6 plain words with no markdown."
)


def valid(le: LessonOut) -> str | None:
    if not le.title.strip():
        return "empty title"
    b = le.body.strip()
    if len(b) < 120:
        return "body too short"
    if "## " not in b:
        return "no section heading"
    if "\n- " not in b and not b.startswith("- "):
        return "no bullet list"
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--curriculum")
    ap.add_argument("--grade", type=int)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--draft", action="store_true", help="insert as draft, not published")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
    if not args.dry_run and not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY.")

    sb = create_client(url, key)
    client = anthropic.Anthropic() if not args.dry_run else None

    curricula = {c["id"]: c for c in sb.table("curricula").select("*").execute().data}
    topics = {t["id"]: t for t in sb.table("topics").select("*").execute().data}

    # Skills (+ which have vetted questions), grouped into (curr, topic, grade) units.
    skills = sb.table("skills").select("id, name, grade, curriculum_id, topic_id").execute().data
    vetted = sb.table("questions").select("skill_id").eq("status", "vetted").execute().data
    have_q = {r["skill_id"] for r in vetted}

    units: dict[tuple[str, str, int], list[str]] = defaultdict(list)
    for s in skills:
        if not s["topic_id"] or s["id"] not in have_q:
            continue
        units[(s["curriculum_id"], s["topic_id"], s["grade"])].append(s["name"])

    # Skip units that already have a published lesson.
    existing = sb.table("lessons").select("curriculum_id, topic_id, grade").eq(
        "status", "published"
    ).execute().data
    done = {(r["curriculum_id"], r["topic_id"], r["grade"]) for r in existing}

    todo = []
    for u, names in units.items():
        if u in done:
            continue
        cid, tid, grade = u
        if args.curriculum and curricula[cid]["code"] != args.curriculum:
            continue
        if args.grade is not None and grade != args.grade:
            continue
        todo.append((cid, tid, grade, names))
    todo.sort(key=lambda x: (curricula[x[0]]["code"], x[2], topics[x[1]]["sort_order"]))
    if args.limit:
        todo = todo[: args.limit]

    print(f"{len(todo)} lessons to generate"
          + (" (dry run)" if args.dry_run else ""))

    made = 0
    for cid, tid, grade, names in todo:
        curr = curricula[cid]
        topic = topics[tid]
        grade_label = f"{curr['grade_noun']} {grade + curr['grade_offset']}"
        tag = f"{curr['code']} {grade_label} · {topic['name']}"
        if args.dry_run:
            print(f"  would generate: {tag}  ({len(names)} skills)")
            continue
        try:
            system = SYSTEM.format(
                age=grade + 5, grade_label=grade_label,
                curriculum=curr["name"], topic=topic["name"],
            )
            user = (
                f"Topic: {topic['name']} for {grade_label} ({curr['name']}).\n"
                f"The child will practice these skills:\n"
                + "\n".join(f"- {n}" for n in names[:10])
                + "\n\nWrite the lesson."
            )
            resp = client.messages.parse(
                model=args.model, max_tokens=2000, system=system,
                messages=[{"role": "user", "content": user}],
                output_format=LessonOut,
            )
            le = resp.parsed_output
            err = valid(le) if le else "no output"
            if err:
                print(f"✗ {tag}: {err}")
                continue
            sb.table("lessons").upsert({
                "curriculum_id": cid, "topic_id": tid, "grade": grade,
                "title": le.title.strip(), "body": le.body.strip(),
                "status": "draft" if args.draft else "published",
            }, on_conflict="curriculum_id,topic_id,grade").execute()
            made += 1
            print(f"✓ {tag} — \"{le.title.strip()}\"")
        except Exception as e:  # noqa: BLE001 — keep going on any single failure
            print(f"✗ {tag}: error — {type(e).__name__}: {e}")

    print(f"\nDone. Generated {made} lessons.")


if __name__ == "__main__":
    main()
