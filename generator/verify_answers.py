#!/usr/bin/env python3
"""Authoritatively re-grade multiple-choice questions and re-vet only the ones
that pass. Fixes the class of bug where a weaker generation pass set the wrong
correct_index or wrote option_explanations that congratulate the wrong option.

For each question a strong model independently solves it from scratch, picks the
correct option, and rewrites clean, aligned per-option explanations:
  - model agrees with the stored answer            -> refresh explanations, VET
  - model disagrees but a second solve confirms it -> fix correct_index, VET (FIX)
  - model says unsolvable / two solves disagree     -> QUARANTINE (status='retired')

This is the automated half of the human vetting gate: it cannot make a bad
question good, but it reliably catches wrong answer keys before kids see them.

Usage:
    export DATABASE_URL=...            # session-pooler postgres URL
    export ANTHROPIC_API_KEY=...
    python generator/verify_answers.py --curriculum ontario --grade 4 --status draft --apply
    python generator/verify_answers.py --skill-code ON.4.B1.1 --dry-run
"""
from __future__ import annotations

import argparse
import os
import sys
from concurrent.futures import ThreadPoolExecutor

from pydantic import BaseModel

try:
    import anthropic
    import psycopg2
    import psycopg2.extras
    from dotenv import load_dotenv
except ImportError as e:
    sys.exit(f"Missing dependency ({e}). Run: pip install -r generator/requirements.txt")

load_dotenv()
DEFAULT_MODEL = os.environ.get("VERIFIER_MODEL", "claude-opus-4-8")
LETTERS = ["A", "B", "C", "D"]


class Verdict(BaseModel):
    # `working` is FIRST so the model reasons step by step BEFORE committing an
    # answer — structured output otherwise makes it pattern-match and slip on
    # arithmetic. This field is never shown to children.
    working: str            # scratch: solve each option, check for >1 correct
    solvable: bool          # false if ambiguous / no correct option / >1 correct / needs a missing image
    correct_letter: str     # "A".."D", or "NONE"
    option_explanations: list[str]  # 4 clean notes, in A,B,C,D order
    explanation: str        # one clean sentence naming the answer


SYSTEM = (
    "You are a meticulous Grade-{grade} math answer-key checker for a children's "
    "learning app ({curriculum}). You are given one multiple-choice question with "
    "exactly four options A, B, C, D.\n\n"
    "First, in the `working` field, solve the problem step by step and evaluate EVERY "
    "option one by one — compute each, and note if more than one option is correct or if "
    "none is. Only after that working, fill the remaining fields:\n"
    "- Set correct_letter to the ONE correct option (A, B, C, or D), or \"NONE\".\n"
    "- Set solvable=false if the question cannot be answered exactly as written: it is "
    "ambiguous, missing information, has more than one correct option, has no correct "
    "option, or depends on an image you were not given.\n"
    "- Write option_explanations: a warm, kid-friendly note (1-2 short sentences) for "
    "EACH option A, B, C, D IN ORDER. For the correct option, affirm it and show how to "
    "get there. For wrong options, gently explain the specific mistake.\n"
    "- Write explanation: ONE clean sentence naming the correct answer and why.\n\n"
    "Critical: do your reasoning silently. NEVER put second-guessing, 'wait', 'let me "
    "recheck', or any meta-commentary into the output fields — they are shown to children "
    "and must be final and clean. Be certain before you answer."
)


def solve(client, model: str, grade: int, curriculum: str, stem: str, options, visual) -> Verdict | None:
    opts = "\n".join(f"{LETTERS[i]}. {o}" for i, o in enumerate(options))
    user = f"Question:\n{stem}\n\nOptions:\n{opts}"
    if visual:
        user += f"\n\n(Question visual data: {visual})"
    try:
        resp = client.messages.parse(
            model=model,
            max_tokens=1500,
            system=SYSTEM.format(grade=grade, curriculum=curriculum),
            messages=[{"role": "user", "content": user}],
            output_format=Verdict,
        )
        return resp.parsed_output
    except Exception as e:  # noqa: BLE001
        print(f"  ! solve error: {type(e).__name__}: {e}")
        return None


def letter_idx(le: str) -> int | None:
    le = (le or "").strip().upper()[:1]
    return LETTERS.index(le) if le in LETTERS else None


def valid_verdict(v: Verdict) -> bool:
    return (
        v.solvable
        and letter_idx(v.correct_letter) is not None
        and len(v.option_explanations) == 4
        and all(s.strip() for s in v.option_explanations)
        and bool(v.explanation.strip())
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--curriculum")
    ap.add_argument("--grade", type=int)
    ap.add_argument("--skill-code")
    ap.add_argument("--status", default="draft", help="which questions to verify (default: draft)")
    ap.add_argument("--source", help="only this source, e.g. ai_generated (verified ones become ai_verified)")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--apply", action="store_true", help="write fixes (default is dry-run)")
    ap.add_argument("--keep-source", action="store_true", help="don't rewrite source to ai_verified (preserve the tag)")
    args = ap.parse_args()

    dburl = os.environ.get("DATABASE_URL")
    if not dburl:
        sys.exit("Set DATABASE_URL (session-pooler postgres URL).")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY.")
    client = anthropic.Anthropic(max_retries=6)  # ride out transient 429/529

    conn = psycopg2.connect(dburl)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    where = ["q.status = %s"]
    params: list = [args.status]
    if args.source:
        where.append("q.source = %s"); params.append(args.source)
    if args.curriculum:
        where.append("c.code = %s"); params.append(args.curriculum)
    if args.grade is not None:
        where.append("s.grade = %s"); params.append(args.grade)
    if args.skill_code:
        where.append("s.code = %s"); params.append(args.skill_code)
    sql = f"""
        select q.id, q.stem, q.options, q.correct_index, q.visual,
               s.grade as grade, c.name as curr_name
        from questions q
        join skills s on q.skill_id = s.id
        join curricula c on s.curriculum_id = c.id
        where {' and '.join(where)}
        order by s.sequence_position, q.created_at
    """
    if args.limit:
        sql += f" limit {int(args.limit)}"
    cur.execute(sql, params)
    rows = cur.fetchall()
    print(f"Verifying {len(rows)} question(s) [status={args.status}, model={args.model}, "
          f"{'APPLY' if args.apply else 'dry-run'}]\n")

    def work(r):
        # Returns (row, verdict, payload, note). SKIP means a solver/transient
        # problem — leave the question untouched so a re-run retries it. We only
        # QUARANTINE on a genuine verdict (model says unsolvable, or two valid
        # solves disagree) — never because of an API error.
        v1 = solve(client, args.model, r["grade"], r["curr_name"], r["stem"], r["options"], r["visual"])
        if v1 is None:
            return r, "SKIP", None, "solver error (left unchanged)"
        if (not v1.solvable) or letter_idx(v1.correct_letter) is None:
            return r, "QUARANTINE", None, "model says unsolvable / no correct option"
        if not valid_verdict(v1):
            v1b = solve(client, args.model, r["grade"], r["curr_name"], r["stem"], r["options"], r["visual"])
            if v1b and valid_verdict(v1b):
                v1 = v1b
            else:
                return r, "SKIP", None, "malformed verdict (left unchanged)"
        idx = letter_idx(v1.correct_letter)
        if idx == r["correct_index"]:
            return r, "OK", v1, None
        # disagreement -> a second independent solve must confirm before we move the key
        v2 = solve(client, args.model, r["grade"], r["curr_name"], r["stem"], r["options"], r["visual"])
        if v2 is None or not valid_verdict(v2):
            return r, "SKIP", None, "disagreement unconfirmed (left unchanged)"
        if letter_idx(v2.correct_letter) == idx:
            return r, "FIX", v1, f"{r['correct_index']}->{idx}"
        return r, "QUARANTINE", None, "two solves disagree (ambiguous)"

    n_ok = n_fix = n_quar = n_skip = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        for r, verdict, v, note in ex.map(work, rows):
            tag = r.get("stem", "")[:48]
            if verdict == "SKIP":
                n_skip += 1
                print(f"  · SKIP  {tag}  ({note})")
            elif verdict == "QUARANTINE":
                n_quar += 1
                print(f"  ⚠ QUARANTINE  {tag}  ({note})")
                if args.apply:
                    cur.execute("update questions set status='retired' where id=%s", (r["id"],))
            else:
                idx = letter_idx(v.correct_letter)
                if verdict == "FIX":
                    n_fix += 1
                    print(f"  ✓ FIX {note}  {tag}")
                else:
                    n_ok += 1
                if args.apply:
                    # Normally mark source='ai_verified' (audit trail + re-run skip).
                    # With --keep-source, leave source as-is (e.g. 'ai_authentic').
                    src_set = "" if args.keep_source else ", source='ai_verified'"
                    cur.execute(
                        f"""update questions set correct_index=%s, option_explanations=%s::jsonb,
                           explanation=%s, status='vetted'{src_set} where id=%s""",
                        (idx, psycopg2.extras.Json(v.option_explanations), v.explanation.strip(), r["id"]),
                    )
            if args.apply:
                conn.commit()

    print(f"\nDone. OK: {n_ok}   FIXED: {n_fix}   QUARANTINED(retired): {n_quar}   SKIPPED: {n_skip}")
    if n_skip:
        print(f"{n_skip} skipped (left unchanged) — re-run the same command to retry just those.")
    if not args.apply:
        print("Dry run — no changes written. Re-run with --apply to persist.")
    conn.close()


if __name__ == "__main__":
    main()
