#!/usr/bin/env python3
"""Daily question top-up: each run picks the next (curriculum, grade) in a fixed
rotation (by day-of-year, so it's stateless) and tops it up with curriculum-
authentic questions, then verifies them. Over ~one rotation it cycles every
(curriculum, grade) that has skills, then repeats.

Run by a GitHub Action with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
ANTHROPIC_API_KEY, DATABASE_URL in the environment.

Usage:
    python generator/daily_topup.py            # today's slice
    python generator/daily_topup.py --dry-run  # just show what it would do
"""
from __future__ import annotations

import datetime
import os
import subprocess
import sys

try:
    import psycopg2
    from dotenv import load_dotenv
except ImportError as e:
    sys.exit(f"Missing dependency ({e}). Run: pip install -r generator/requirements.txt")

load_dotenv()
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = int(os.environ.get("TOPUP_TARGET", "25"))
GEN_MODEL = os.environ.get("TOPUP_GEN_MODEL", "claude-sonnet-4-6")
VERIFY_MODEL = os.environ.get("TOPUP_VERIFY_MODEL", "claude-sonnet-4-6")


def combos() -> list[tuple[str, int]]:
    db = os.environ["DATABASE_URL"]
    conn = psycopg2.connect(db); cur = conn.cursor()
    cur.execute(
        """select c.code, s.grade from skills s join curricula c on s.curriculum_id = c.id
           group by c.code, s.grade order by c.code, s.grade"""
    )
    rows = [(r[0], r[1]) for r in cur.fetchall()]
    conn.close()
    return rows


def run(cmd):
    print("  $", " ".join(cmd[1:]), flush=True)
    return subprocess.run(cmd, cwd=REPO).returncode


def main() -> None:
    for var in ("DATABASE_URL", "ANTHROPIC_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
        if not os.environ.get(var):
            sys.exit(f"Set {var}.")
    rot = combos()
    if not rot:
        sys.exit("No (curriculum, grade) combos found.")
    # Stateless rotation: day-of-year picks the slice; no state file to maintain.
    doy = datetime.date.fromisoformat(os.environ["TOPUP_DATE"]).timetuple().tm_yday \
        if os.environ.get("TOPUP_DATE") else _today_doy()
    code, grade = rot[doy % len(rot)]
    print(f"Day {doy}: topping up {code} grade {grade} "
          f"(slice {doy % len(rot) + 1}/{len(rot)})", flush=True)
    if "--dry-run" in sys.argv:
        return

    run([sys.executable, "generator/generate_questions.py", "--curriculum", code,
         "--grade", str(grade), "--target", str(TARGET), "--source", "ai_authentic",
         "--isolate", "--model", GEN_MODEL])
    run([sys.executable, "generator/verify_answers.py", "--curriculum", code,
         "--grade", str(grade), "--status", "draft", "--source", "ai_authentic",
         "--apply", "--keep-source", "--workers", "4", "--model", VERIFY_MODEL])
    print("Done.", flush=True)


def _today_doy() -> int:
    # Date.* is unavailable in some sandboxes; this script runs in CI where it's fine.
    return datetime.date.today().timetuple().tm_yday


if __name__ == "__main__":
    main()
