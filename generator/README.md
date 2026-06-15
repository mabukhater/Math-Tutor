# Question-bank generator (M1)

Offline, batch-only. Produces the vetted MCQ bank the bot and placement test
draw from. **Never invoked in the child-facing path** — the Anthropic API is
used only here; the bot serves only `status='vetted'`.

## Flow

```
1. generate_questions.py   Anthropic API → draft rows (status='draft')
2. vet_questions.py        human reviews each draft → vetted | retired
3. (bot/web serve only status='vetted')
```

## Setup

```bash
pip install -r generator/requirements.txt
cp .env.example .env    # fill SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
```

Requires the schema applied and skills seeded (see top-level README → Setup).

## Generate drafts

```bash
# All grade 3–5 skills, ~12 questions each (skips skills that already have enough)
python generator/generate_questions.py

# Narrow scope / tune volume
python generator/generate_questions.py --grade 3
python generator/generate_questions.py --skill-code CCSS.3.NF.A.1 --target 15
python generator/generate_questions.py --dry-run        # preview, no writes
```

Model defaults to `claude-opus-4-8` (override with `GENERATOR_MODEL` or `--model`).
Items are produced via structured outputs; each is validated (exactly 4 distinct
options, `correct_index` 0–3, difficulty 1–5) before insert — invalid items are
skipped, not stored.

## Vet drafts

```bash
python generator/vet_questions.py            # interactive review of all drafts
python generator/vet_questions.py --grade 3
python generator/vet_questions.py --stats    # counts by status, no review
```

Per question: `[v]` vet · `[r]` retire · `[s]` skip · `[q]` quit. Target
~10–15 vetted per skill for v1.

> No live admin UI in the MVP — this CLI *is* the vetting screen. A web review
> page can replace it later; the `status` column contract stays the same.
