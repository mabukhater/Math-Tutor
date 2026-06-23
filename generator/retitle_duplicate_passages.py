#!/usr/bin/env python3
"""Give passages that share a title distinct, content-specific titles.

Several passages were generated with the same title (e.g. four different
"The Secret Life of Honeybees" passages in Grade 4). They are NOT duplicates —
each has a different body and its own questions — but the repeated titles make
the reading ladder look like it repeats. This keeps the first passage in each
(title, grade) group and retitles the rest from their actual content.

Usage:
    export DATABASE_URL=... ANTHROPIC_API_KEY=...
    python generator/retitle_duplicate_passages.py            # dry run
    python generator/retitle_duplicate_passages.py --apply
"""
from __future__ import annotations

import os
import sys

from pydantic import BaseModel

try:
    import anthropic
    import psycopg2
    import psycopg2.extras
    from dotenv import load_dotenv
except ImportError as e:
    sys.exit(f"Missing dependency ({e}). Run: pip install -r generator/requirements.txt")

load_dotenv()
MODEL = os.environ.get("RETITLE_MODEL", "claude-sonnet-4-6")

SYSTEM = (
    "You write one short, specific, kid-friendly title for a reading passage (Grade {grade}). "
    "It must capture THIS passage's particular angle and be clearly different from the generic "
    "title \"{shared}\". 3-6 words, Title Case, no quotation marks, no ending punctuation."
)


class TitleOut(BaseModel):
    title: str


def excerpt(paragraphs) -> str:
    if not isinstance(paragraphs, list):
        return ""
    return " ".join(str(p.get("text", "")) for p in paragraphs[:2])[:700]


def main() -> None:
    db = os.environ.get("DATABASE_URL")
    if not db:
        sys.exit("Set DATABASE_URL.")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY.")
    apply = "--apply" in sys.argv
    client = anthropic.Anthropic(max_retries=5)
    conn = psycopg2.connect(db)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Reserve every existing (grade, title) so new titles never collide.
    cur.execute("select grade, lower(title) lt from passages where status='published'")
    used = {(r["grade"], r["lt"]) for r in cur.fetchall()}

    cur.execute(
        """select title, grade from passages where status='published'
           group by title, grade having count(*) > 1 order by grade, title"""
    )
    groups = cur.fetchall()
    n_re = 0
    for g in groups:
        cur.execute(
            """select id, title, grade, paragraphs from passages
               where status='published' and title=%s and grade=%s
               order by week, level_order""",
            (g["title"], g["grade"]),
        )
        rows = cur.fetchall()
        for row in rows[1:]:  # keep the first; retitle the rest
            shared, grade = row["title"], row["grade"]
            new_title = None
            for _ in range(4):
                try:
                    resp = client.messages.parse(
                        model=MODEL,
                        max_tokens=120,
                        system=SYSTEM.format(grade=grade, shared=shared),
                        messages=[{"role": "user", "content": "Passage excerpt:\n" + excerpt(row["paragraphs"])}],
                        output_format=TitleOut,
                    )
                    t = resp.parsed_output.title.strip().strip('"').rstrip(".").strip()
                except Exception as e:  # noqa: BLE001
                    print(f"  ! {shared}: {type(e).__name__}: {e}")
                    continue
                if t and t.lower() != shared.lower() and (grade, t.lower()) not in used:
                    new_title = t
                    break
            if not new_title:
                new_title = f"{shared} — Part {rows.index(row) + 1}"
            used.add((grade, new_title.lower()))
            print(f"  g{grade}: '{shared}' -> '{new_title}'")
            n_re += 1
            if apply:
                cur.execute("update passages set title=%s where id=%s", (new_title, row["id"]))
                conn.commit()

    print(f"\n{'Renamed' if apply else 'Would rename'} {n_re} passages.{'' if apply else '  (dry run — pass --apply)'}")
    conn.close()


if __name__ == "__main__":
    main()
