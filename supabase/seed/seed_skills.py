#!/usr/bin/env python3
"""Seed the `skills` ladder from skills_common_core_3_5.json.

Run AFTER 0001_init.sql has been applied (curricula already contains
'common_core'). sequence_position is assigned from the JSON array order so the
ladder stays monotonic across grades 3->5 with no manual numbering.

Usage:
    export SUPABASE_URL=...                # https://<ref>.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=...   # service role (server-side only)
    python supabase/seed/seed_skills.py

Idempotent: upserts on (curriculum_id, code).
"""
import json
import os
import sys
from pathlib import Path

try:
    from supabase import create_client
except ImportError:
    sys.exit("Missing dependency: pip install supabase")

HERE = Path(__file__).resolve().parent
DEFAULT_DATA = HERE / "skills_common_core_3_5.json"


def main() -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.")

    # Optional path arg lets this seed any curriculum ladder (Common Core / UK / Singapore).
    data_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DATA
    if not data_path.exists():
        sys.exit(f"Ladder file not found: {data_path}")
    payload = json.loads(data_path.read_text())
    curriculum_code = payload["curriculum_code"]
    skills = payload["skills"]

    sb = create_client(url, key)

    curr = sb.table("curricula").select("id").eq("code", curriculum_code).limit(1).execute()
    if not curr.data:
        sys.exit(f"Curriculum '{curriculum_code}' not found. Apply 0001_init.sql first.")
    curriculum_id = curr.data[0]["id"]

    rows = [
        {
            "curriculum_id": curriculum_id,
            "code": s["code"],
            "name": s["name"],
            "domain": s.get("domain"),
            "grade": s["grade"],
            "sequence_position": i,
        }
        for i, s in enumerate(skills)
    ]

    sb.table("skills").upsert(rows, on_conflict="curriculum_id,code").execute()
    print(f"Seeded {len(rows)} skills for '{curriculum_code}' "
          f"(grades {min(s['grade'] for s in skills)}-{max(s['grade'] for s in skills)}).")


if __name__ == "__main__":
    main()
