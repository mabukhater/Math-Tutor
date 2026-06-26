#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash). Gates `git push` on a passing production build.
# Railway auto-deploys `main` on push, so a push that doesn't build = a broken
# deploy + a "Build failed!" email. This runs the SAME build Railway runs, first,
# and blocks the push if it fails. Fires on every Bash call but exits immediately
# unless the command is a git push.
#
# Exit 2 = block (reason fed back to Claude). Exit 0 = allow.
# Bypass once for a known-safe push (docs only, etc.):  SKIP_BUILD_CHECK=1 git push
set -uo pipefail

CMD="$(python3 -c 'import json,sys
try:
    print(json.load(sys.stdin).get("tool_input",{}).get("command",""))
except Exception:
    print("")' 2>/dev/null)"

# Only act on git push.
case "$CMD" in
  *"git push"*) : ;;
  *) exit 0 ;;
esac

# Explicit opt-out.
[ "${SKIP_BUILD_CHECK:-0}" = "1" ] && exit 0

ROOT="${CLAUDE_PROJECT_DIR:-.}"
APP="$ROOT/web"
[ -d "$APP" ] || APP="$ROOT"
[ -f "$APP/package.json" ] || exit 0 # no build to run -> allow

block() { echo "BLOCKED by git-push build check: $1" >&2; exit 2; }

cd "$APP" || exit 0
log="$(mktemp)"
echo "Pre-push gate: running the production build (the same one Railway runs)..." >&2
if npm run build >"$log" 2>&1; then
  rm -f "$log"
  exit 0
fi
tail_out="$(tail -25 "$log")"
rm -f "$log"
block "the production build FAILED — pushing would break the Railway deploy and trigger a 'Build failed!' email. Fix the build, then push again (or, if you are certain, bypass once with: SKIP_BUILD_CHECK=1 git push).

--- last 25 lines of build output ---
$tail_out"
