#!/usr/bin/env python3
"""Regenerate each curriculum's question bank to be curriculum-AUTHENTIC.

Per curriculum, in order:
  1. generate_questions.py  (--source ai_authentic --isolate) — make authentic
     questions tagged 'ai_authentic', alongside the existing generic ones.
  2. verify_answers.py      (--source ai_authentic --keep-source) — Opus/Sonnet
     answer-key gate; vet the good ones, retire broken, keep the tag.
  3. Retire the OLD generic questions, but only for skills that now have enough
     authentic ones — so no skill ever goes empty mid-regen.

Gap-free (old stays live until authentic is vetted) and resumable (re-run
continues: generation skips skills already at target authentic; verification
only touches remaining drafts; the retire step is idempotent). Waits out API
overload (529) with a cheap probe instead of hammering.

Usage:
    export DATABASE_URL=... ANTHROPIC_API_KEY= (and SUPABASE_URL/KEY via .env)
    python generator/regenerate_curricula.py                       # all four
    python generator/regenerate_curricula.py uk_national singapore # subset
"""
import os, sys, time, subprocess
from dotenv import load_dotenv
import anthropic
import psycopg2

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(REPO, ".env"))
DB = os.environ["DATABASE_URL"]
GEN_MODEL = os.environ.get("REGEN_GEN_MODEL", "claude-sonnet-4-6")
VERIFY_MODEL = os.environ.get("REGEN_VERIFY_MODEL", "claude-sonnet-4-6")
TARGET = int(os.environ.get("REGEN_TARGET", "20"))
FLOOR = int(os.environ.get("REGEN_FLOOR", "12"))  # retire old once a skill has >= FLOOR authentic vetted

CURRICULA = sys.argv[1:] or ["uk_national", "singapore", "ontario", "common_core"]
_probe = anthropic.Anthropic(max_retries=0)


def api_up() -> bool:
    try:
        _probe.messages.create(model="claude-haiku-4-5-20251001", max_tokens=5,
                               messages=[{"role": "user", "content": "ok"}])
        return True
    except Exception as e:  # noqa: BLE001
        print("  api probe:", type(e).__name__, flush=True)
        return False


def wait_api() -> bool:
    for _ in range(60):  # up to ~3h
        if api_up():
            return True
        time.sleep(180)
    return False


def run(cmd):
    env = dict(os.environ, DATABASE_URL=DB)
    print("  $", " ".join(cmd[1:]), flush=True)
    return subprocess.run(cmd, cwd=REPO, env=env).returncode


def retire_old(cur_code: str) -> int:
    conn = psycopg2.connect(DB); c = conn.cursor()
    c.execute(
        """update questions q set status='retired'
           from skills s, curricula cu
           where q.skill_id = s.id and s.curriculum_id = cu.id and cu.code = %s
             and q.status = 'vetted' and q.source <> 'ai_authentic'
             and s.id in (
               select skill_id from questions
               where source = 'ai_authentic' and status = 'vetted'
               group by skill_id having count(*) >= %s)""",
        (cur_code, FLOOR),
    )
    n = c.rowcount; conn.commit()
    c.execute(
        """select count(*) from questions q join skills s on q.skill_id=s.id
           join curricula cu on s.curriculum_id=cu.id
           where cu.code=%s and q.status='vetted' and q.source='ai_authentic'""",
        (cur_code,),
    )
    authentic = c.fetchone()[0]; conn.close()
    return n, authentic


def main():
    for code in CURRICULA:
        print(f"\n===== {code} =====", flush=True)
        if not wait_api():
            print("API overloaded too long — stopping; re-run to resume.", flush=True)
            return
        run(["/usr/bin/python3", "generator/generate_questions.py", "--curriculum", code,
             "--target", str(TARGET), "--source", "ai_authentic", "--isolate", "--model", GEN_MODEL])
        if not wait_api():
            print("API overloaded too long — stopping; re-run to resume.", flush=True)
            return
        run(["/usr/bin/python3", "generator/verify_answers.py", "--curriculum", code,
             "--status", "draft", "--source", "ai_authentic", "--apply", "--keep-source",
             "--workers", "4", "--model", VERIFY_MODEL])
        retired, authentic = retire_old(code)
        print(f"  {code}: {authentic} authentic vetted; retired {retired} old generic", flush=True)
    print("\nALL CURRICULA DONE", flush=True)


if __name__ == "__main__":
    main()
