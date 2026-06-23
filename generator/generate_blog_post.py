#!/usr/bin/env python3
"""Write one new blog post for Astute Academy and prepend it to
web/src/content/articles.ts. Run daily by a GitHub Action; the workflow commits
and pushes, which deploys it and refreshes the sitemap.

Picks a fresh, SEO-relevant topic (parent-friendly math/reading/curriculum
guidance), avoiding the titles/slugs already published.

Usage:
    export ANTHROPIC_API_KEY=...
    python generator/generate_blog_post.py            # writes the file
    python generator/generate_blog_post.py --dry-run  # print only
"""
from __future__ import annotations

import os
import re
import sys

from pydantic import BaseModel

try:
    import anthropic
    from dotenv import load_dotenv
except ImportError as e:
    sys.exit(f"Missing dependency ({e}). Run: pip install anthropic python-dotenv pydantic")

load_dotenv()
MODEL = os.environ.get("BLOG_MODEL", "claude-opus-4-8")
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTICLES = os.path.join(REPO, "web", "src", "content", "articles.ts")

CATEGORIES = ["Early Learning", "Curricula", "Reading", "Study Habits", "Parent Guide", "Math Tips"]

SYSTEM = (
    "You write one warm, genuinely useful blog post for Astute Academy — a "
    "curriculum-aligned math & reading practice app for children grades 1–8 "
    "(US Common Core, UK National Curriculum, Singapore Math, Ontario). The "
    "audience is parents. The post should be SEO-relevant (a question or topic a "
    "parent would search), specific, and practical — not generic filler.\n\n"
    "Rules:\n"
    "- 500–800 words. Markdown ONLY: '## ' and '### ' headings, blank-line "
    "paragraphs, and '- ' bullet lists. No bold/italics, links, tables, images, "
    "code, backticks, or the characters ` or ${ anywhere.\n"
    "- title: a clear, search-friendly H1 (no 'Astute Academy' in it).\n"
    "- slug: lowercase, hyphenated, derived from the title.\n"
    "- category: exactly one of: " + ", ".join(CATEGORIES) + ".\n"
    "- excerpt: one inviting sentence (the meta description), under 160 characters.\n"
    "- Be concrete and original. Avoid topics already covered (listed by the user)."
)


class Post(BaseModel):
    title: str
    slug: str
    category: str
    excerpt: str
    body: str


def existing() -> tuple[set[str], list[str]]:
    src = open(ARTICLES, encoding="utf-8").read()
    slugs = set(re.findall(r'slug:\s*"([^"]+)"', src))
    titles = re.findall(r'title:\s*"([^"]+)"', src)
    return slugs, titles


def clean(s: str) -> str:
    return s.replace("`", "'").replace("${", "$ {")


def valid(p: Post, slugs: set[str]) -> str | None:
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", p.slug):
        return f"bad slug: {p.slug}"
    if p.slug in slugs:
        return "slug already exists"
    if len(p.body.split()) < 350:
        return "body too short"
    if "## " not in p.body:
        return "no markdown headings"
    if p.category not in CATEGORIES:
        return f"bad category: {p.category}"
    return None


def main() -> None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY.")
    dry = "--dry-run" in sys.argv
    slugs, titles = existing()
    client = anthropic.Anthropic(max_retries=6)

    post = None
    for _ in range(4):
        resp = client.messages.parse(
            model=MODEL, max_tokens=3000, system=SYSTEM,
            messages=[{"role": "user", "content":
                       "Write today's post. Already published (avoid these topics):\n- "
                       + "\n- ".join(titles[:40])}],
            output_format=Post,
        )
        p = resp.parsed_output
        if not p:
            continue
        p.body = clean(p.body.strip())
        p.title = clean(p.title.strip())
        p.excerpt = clean(p.excerpt.strip())
        err = valid(p, slugs)
        if not err:
            post = p
            break
        print(f"retry: {err}")
    if not post:
        sys.exit("Could not produce a valid post after retries.")

    read_minutes = max(3, round(len(post.body.split()) / 200))
    obj = (
        "  {\n"
        f'    slug: "{post.slug}",\n'
        f'    title: "{post.title.replace(chr(34), chr(39))}",\n'
        f'    category: "{post.category}",\n'
        f"    readMinutes: {read_minutes},\n"
        f'    excerpt:\n      "{post.excerpt.replace(chr(34), chr(39))}",\n'
        f"    body: `{post.body}`,\n"
        "  },\n"
    )
    if dry:
        print(obj)
        return

    src = open(ARTICLES, encoding="utf-8").read()
    anchor = "export const ARTICLES: Article[] = [\n"
    if anchor not in src:
        sys.exit("Could not find ARTICLES anchor in articles.ts")
    src = src.replace(anchor, anchor + obj, 1)
    open(ARTICLES, "w", encoding="utf-8").write(src)
    print(f"Added post: {post.title}  ({read_minutes} min, /blog/{post.slug})")


if __name__ == "__main__":
    main()
