#!/usr/bin/env python3
"""Unit tests for the skill->topic classifier (no DB). Run: python -m pytest
or just `python generator/test_map_topics.py`."""
from map_topics import classify

# (name, domain, grade, expected_topic)
CASES = [
    # The substring bugs that previously mislabeled these as ratio/algebra:
    ("Add within 100 using place value strategies", "Number & Operations in Base Ten", 1, "add_sub"),
    ("Apply properties of operations (commutative, associative)", "Operations & Algebraic Thinking", 3, "algebra"),
    ("Tell the time on analogue and 12-/24-hour clocks", "Measurement", 2, "time"),
    ("Understand integers and rational numbers", "Number & Place Value", 6, "numbers"),
    ("Round numbers to the nearest power of 10", "Number & Place Value", 4, "numbers"),
    # Combined operations:
    ("Add and subtract within 20", "Addition & Subtraction", 1, "add_sub"),
    ("Recall multiplication and division facts", "Multiplication & Division", 2, "mult_div"),
    # Topic-specific signals beat the operation in the name:
    ("Add and subtract fractions with like denominators", "Fractions", 4, "fractions"),
    ("Multiply decimals by powers of ten", "Decimals", 5, "decimals"),
    ("Find a percentage of an amount", "Percentage", 6, "percentages"),
    ("Count coins and make change", "Money", 2, "money"),
    ("Equivalent ratios and ratio problems", "Ratio & Proportion", 5, "ratio"),
    ("Identify properties of 2-D and 3-D shapes", "Geometry", 1, "geometry"),
    ("Measure length using non-standard units", "Measurement", 1, "measurement"),
    ("Interpret and construct pictograms", "Statistics", 2, "data"),
    ("Solve one- and two-step word problems", "Operations & Algebraic Thinking", 2, "problem_solving"),
]


def main() -> None:
    failures = []
    for name, domain, grade, expected in CASES:
        got = classify(name, domain, grade)
        ok = got == expected
        print(f"{'ok ' if ok else 'FAIL'}  {expected:15s} <- {name[:48]!r}" + ("" if ok else f"  got={got}"))
        if not ok:
            failures.append((name, expected, got))
    print(f"\n{len(CASES) - len(failures)}/{len(CASES)} passed")
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
