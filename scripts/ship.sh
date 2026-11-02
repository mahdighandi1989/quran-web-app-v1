#!/usr/bin/env bash
# Ship the current work: verify ⇒ commit ⇒ push the working branch ⇒ merge into
# main ⇒ push main. Render auto-deploys `main`, so a successful run = deployed.
#
#   scripts/ship.sh "type(scope): summary"
#
# Refuses to ship if any check fails. Never force-pushes. Never skips a test.
set -euo pipefail

MSG="${1:-}"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
LOGDIR="$(mktemp -d)"

say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
retry() { # network ops: 4 retries with exponential backoff (2s, 4s, 8s, 16s)
  local n=0 delay=2
  until "$@"; do
    n=$((n + 1)); [ "$n" -ge 5 ] && return 1
    echo "retrying in ${delay}s…"; sleep "$delay"; delay=$((delay * 2))
  done
}

# --- 1. checks -------------------------------------------------------------
say "Source files hidden by .gitignore"
# A file that exists locally but is ignored builds fine here and is missing on Render.
hidden="$(git ls-files --others --ignored --exclude-standard -- src server scripts docs backend tests public experiences index.html \
  | grep -v -E '(__pycache__|\.pyc$|\.pytest_cache|node_modules/|^docs/supervisor/inspection/(QUEUE|URGENT)\.md$|^docs/supervisor/inspection/(shots|files|after)/|^docs/supervisor/last_[a-z_]+\.json$)' || true)"
if [ -n "$hidden" ]; then
  echo "$hidden"
  echo "❌ these source files exist locally but are ignored by .gitignore — they would be missing on Render. Fix .gitignore."
  exit 1
fi

say "Frontend dependencies"
[ -d node_modules ] || npm ci --no-audit --no-fund

run_checks() {
  say "Frontend unit tests (vitest)"
  npx vitest run >"$LOGDIR/vitest.log" 2>&1 || { tail -60 "$LOGDIR/vitest.log"; echo "❌ vitest failed — not shipping"; return 1; }
  grep -E "Test Files|Tests " "$LOGDIR/vitest.log" | tail -2

  say "Frontend build (vite)"
  npm run build >"$LOGDIR/build.log" 2>&1 || { tail -40 "$LOGDIR/build.log"; echo "❌ build failed — not shipping"; return 1; }
  grep -iE "warn|error" "$LOGDIR/build.log" | grep -v "chunks are larger" | head -5 || true

  say "Server tests (node --test)"
  if [ -d server/test ]; then
    node --test server/test/ >"$LOGDIR/server.log" 2>&1 || { tail -60 "$LOGDIR/server.log"; echo "❌ server tests failed — not shipping"; return 1; }
    grep -E "^# (pass|fail)" "$LOGDIR/server.log" || true
  fi

  say "Python tests (pytest)"
  python3 -c "import pytest" 2>/dev/null || python3 -m pip install -q pytest
  python3 -m pytest -q >"$LOGDIR/pytest.log" 2>&1 || { tail -40 "$LOGDIR/pytest.log"; echo "❌ pytest failed — not shipping"; return 1; }
  tail -1 "$LOGDIR/pytest.log"

  say "Docs gate"
  python3 scripts/docs_gate.py || { echo "❌ docs gate failed — not shipping"; return 1; }
}
run_checks || exit 1

# --- 2. commit ---------------------------------------------------------------
BRANCH="$(git branch --show-current)"
if [ -n "$(git status --porcelain)" ]; then
  [ -n "$MSG" ] || { echo "❌ uncommitted changes: pass a commit message"; exit 1; }
  say "Commit"
  git add -A
  git commit -q -m "$MSG"
fi

# --- 3. push working branch --------------------------------------------------
if [ "$BRANCH" != "main" ]; then
  say "Push $BRANCH"
  retry git push -q -u origin "$BRANCH"
fi

# --- 4. merge into main and push (deploy) ------------------------------------
say "Merge into main"
retry git fetch -q origin main
if ! git merge-base --is-ancestor origin/main HEAD; then
  echo "main has moved — merging origin/main into $BRANCH first"
  git merge -q --no-edit origin/main
  run_checks || { echo "❌ checks failed after merging main"; exit 1; }
  [ "$BRANCH" != "main" ] && retry git push -q origin "$BRANCH"
fi
retry git push -q origin HEAD:main
say "Shipped $(git rev-parse --short HEAD) to main — Render will deploy it automatically"
echo "Verify the deploy (not just a health ping): python3 scripts/supervisor/deploys.py"
