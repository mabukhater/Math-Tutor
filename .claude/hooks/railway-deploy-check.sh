#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash). Gates Railway deploy commands.
# Fires on every Bash call but exits immediately unless the command is a deploy.
#
# Exit 2 = block (reason fed back to Claude). Exit 0 = allow.
# Designed to fail OPEN: if it can't determine something, it allows rather than
# wedging you — except production, which it treats as block-by-default.

set -uo pipefail

CMD="$(python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("tool_input",{}).get("command",""))
except Exception:
    print("")' 2>/dev/null)"

# Only act on Railway deploy commands.
case "$CMD" in
  *"railway up"*|*"railway redeploy"*|*"railway deploy"*) : ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
block() { echo "BLOCKED by railway-deploy-check: $1" >&2; exit 2; }

have_railway=0
command -v railway >/dev/null 2>&1 && have_railway=1

# --- Resolve target environment (from -e/--environment flag, else railway status) ---
env_target=""
if [[ "$CMD" =~ (-e|--environment)[[:space:]]+([A-Za-z0-9_-]+) ]]; then
  env_target="${BASH_REMATCH[2]}"
elif [ "$have_railway" = 1 ]; then
  env_target="$(timeout 15 railway status 2>/dev/null | grep -i -m1 'environment' | sed 's/.*://; s/[[:space:]]//g')"
fi
env_lc="$(printf '%s' "$env_target" | tr '[:upper:]' '[:lower:]')"

# --- Gate 1: production safety (block by default) ---
if [ "$env_lc" = "prod" ] || [ "$env_lc" = "production" ]; then
  if [ "${ALLOW_PROD_DEPLOY:-0}" != "1" ]; then
    block "target environment is PRODUCTION ($env_target) — this affects live users.
Re-run with the override once you're sure tests are green:
    ALLOW_PROD_DEPLOY=1 $CMD"
  fi
  # 1b: never ship uncommitted code to prod
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    block "uncommitted changes present — a production deploy must come from committed, reproducible code. Commit or stash first."
  fi
fi

# --- Gate 2: required env vars present in the Railway target ---
if [ "$have_railway" = 1 ] && [ -f ".env.example" ]; then
  vars_out="$(timeout 15 railway variables 2>/dev/null)"
  if [ -n "$vars_out" ]; then
    missing=""
    while IFS= read -r key; do
      [ -z "$key" ] && continue
      if ! printf '%s' "$vars_out" | grep -qw -- "$key"; then
        missing="${missing} ${key}"
      fi
    done < <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env.example | sed 's/=.*//')
    if [ -n "$missing" ]; then
      block "these keys from .env.example are not set in the Railway target environment:${missing}
Set each with: railway variables --set KEY=value   then redeploy."
    fi
  fi
fi

exit 0
