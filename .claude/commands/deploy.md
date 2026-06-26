---
description: Safely deploy to Railway — verify gates, deploy, then confirm the healthcheck passes.
argument-hint: [environment, e.g. staging | production]
model: inherit
---

Deploy this project to Railway. Target environment: $ARGUMENTS (default: staging).
The railway-deploy-check hook will block a production deploy unless gates pass —
do not try to bypass it.

## 1. Pre-flight
- `git status` — the tree should be clean. If deploying to production it MUST be.
- `git log --oneline -10` — show me what will go out.
- Confirm gates are green: run typecheck + the full test suite. If red, STOP.

## 2. Deploy
- For staging: `railway up` (or `railway up --environment staging`).
- For production: tell me to run it myself with `ALLOW_PROD_DEPLOY=1` set, since
  the hook requires that override. Do not set it on my behalf.

## 3. Verify (do not call the deploy done until this passes)
- Read the healthcheck path from `railway.json`/`railway.toml` if present, else
  use `/health`.
- Poll `"$BASE_URL/<healthcheck>"` every 5s for up to 2 minutes. Report the first
  200, or fail loudly if it never returns healthy.
- Run `railway logs` and scan the last ~50 lines for errors or crash loops.

## 4. Report
Summarize: environment deployed, commit SHA, healthcheck result, and anything
suspicious in the logs. If the healthcheck failed, recommend `railway rollback`.
