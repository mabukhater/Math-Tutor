#!/usr/bin/env python3
"""Map every skill to exactly one normalized topic (skills.topic_id).

Deterministic classifier: strong keyword signals on the skill NAME first
(so "add and subtract fractions" -> fractions, not addition), then a
domain-string fallback, then a grade-based fallback for the genuinely
ambiguous "Operations & Algebraic Thinking" / "Calculation" strands.

Prints the resulting distribution and lists anything left unmapped for review.

Usage:
    export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
    python generator/map_topics.py --dry-run
    python generator/map_topics.py
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from collections import Counter

try:
    from supabase import create_client
    from dotenv import load_dotenv
except ImportError as e:
    sys.exit(f"Missing dependency ({e}). Run: pip install -r generator/requirements.txt")

load_dotenv()

# (topic_code, [keyword stems]) — checked top to bottom, first hit wins.
# Matching is PREFIX-at-word-boundary: a stem matches when it begins a word
# (so "multipl" hits "multiplication" but "ratio" does NOT hit "operations").
NAME_RULES: list[tuple[str, list[str]]] = [
    ("fractions",      ["fraction", "numerator", "denominator", "mixed number", "equivalent fract"]),
    ("decimals",       ["decimal"]),
    ("percentages",    ["percent"]),
    # Unambiguous number-sense terms first, so "rational numbers" beats "ratio".
    ("numbers",        ["rational", "irrational", "integer", "negative number", "prime",
                         "composite", "roman numeral", "rounding"]),
    ("ratio",          ["ratio", "proportion", "rate", "scale factor", "unit rate"]),
    ("money",          ["money", "coin", "cent", "dollar", "pound", "price", "cost", "change",
                         "currenc", "penny", "pence"]),
    ("time",           ["clock", "o'clock", "o’clock", "elapsed", "duration", "calendar",
                         "telling time", "time interval", "hour", "minute"]),
    ("geometry",       ["geometr", "shape", "angle", "triangle", "polygon", "symmetr", "coordinate",
                         "quadrilateral", "rectangle", "circle", "solid", "vertex", "vertic", "edge",
                         "net of", "transformation", "rotation", "reflection", "translation",
                         "congruent", "similar", "parallel", "perpendicular", "area", "perimeter"]),
    ("measurement",    ["measure", "length", "mass", "weight", "capacit", "volume", "liter", "litre",
                         "gram", "kilogram", "metre", "meter", "centimet", "millimet", "temperature",
                         "convert", "unit of", "units of"]),
    ("data",           ["graph", "data", "chart", "pictograph", "pictogram", "statistic", "median",
                         "probab", "frequency", "survey", "histogram", "tally", "dot plot",
                         "average"]),
    ("algebra",        ["algebra", "equation", "expression", "variable", "function", "inequalit",
                         "unknown", "solve for", "formula", "linear", "slope", "exponent", "indices"]),
    ("mult_div",       ["multipl", "product", "times table", "array", "multiple of", "factor",
                         "divis", "divid", "divide", "quotient", "remainder", "grouping"]),
    ("add_sub",        ["add", "sum", "plus", "total", "altogether",
                         "subtract", "difference", "minus", "take away"]),
    ("numbers",        ["place value", "round", "count", "digit", "compare", "order", "number line",
                         "odd", "even", "square root", "estimat", "ordinal", "skip count"]),
    ("problem_solving",["word problem", "two-step", "two step", "multi-step", "multistep", "problem"]),
]

# domain substring -> topic_code (fallback when the name had no strong signal).
DOMAIN_RULES: list[tuple[str, str]] = [
    ("Fraction", "fractions"),
    ("Decimal", "decimals"),
    ("Percent", "percentages"),
    ("Ratio", "ratio"),
    ("Proportion", "ratio"),
    ("Algebra", "algebra"),
    ("Expression", "algebra"),
    ("Equation", "algebra"),
    ("Function", "algebra"),
    ("Geometry", "geometry"),
    ("Area", "geometry"),
    ("Volume", "geometry"),
    ("Perimeter", "geometry"),
    ("Statistics", "data"),
    ("Probability", "data"),
    ("Data", "data"),
    ("Money", "money"),
    ("Measurement", "measurement"),
    ("Place Value", "numbers"),
    ("Base Ten", "numbers"),
    ("Addition", "add_sub"),
    ("Subtraction", "add_sub"),
    ("Multiplication", "mult_div"),
    ("Division", "mult_div"),
]


def _hit(stem: str, text: str) -> bool:
    # Prefix match at a word boundary: \bstem (stem may continue the word).
    return re.search(r"\b" + re.escape(stem), text) is not None


def classify(name: str, domain: str, grade: int) -> str:
    n = (name or "").lower()
    for topic, kws in NAME_RULES:
        if any(_hit(k, n) for k in kws):
            return topic
    d = (domain or "").lower()
    for sub, topic in DOMAIN_RULES:
        if _hit(sub.lower(), d):
            return topic
    # Ambiguous combined strands (OA / Calculation): fall back by grade band.
    if grade <= 2:
        return "add_sub"
    if grade <= 5:
        return "mult_div"
    return "algebra"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    topics = {t["code"]: t["id"] for t in sb.table("topics").select("id, code").execute().data}
    skills = sb.table("skills").select("id, name, domain, grade").execute().data
    print(f"{len(skills)} skills, {len(topics)} topics")

    dist: Counter = Counter()
    updates: list[tuple[str, str]] = []
    for s in skills:
        code = classify(s["name"], s.get("domain", ""), s["grade"])
        dist[code] += 1
        updates.append((s["id"], topics[code]))

    print("\nDistribution:")
    for code, n in sorted(dist.items(), key=lambda x: -x[1]):
        print(f"  {code:16s} {n}")

    if args.dry_run:
        print("\n(dry run — no writes)")
        return

    print("\nWriting topic_id ...")
    for i, (sid, tid) in enumerate(updates):
        sb.table("skills").update({"topic_id": tid}).eq("id", sid).execute()
        if (i + 1) % 100 == 0:
            print(f"  {i + 1}/{len(updates)}")
    print(f"done — {len(updates)} skills mapped")


if __name__ == "__main__":
    main()
