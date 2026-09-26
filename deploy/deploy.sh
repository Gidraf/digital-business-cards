#!/usr/bin/env bash
#
# Deploy the cards.gidraf.dev stack.
#
#   ./deploy.sh              # all three, in dependency order
#   ./deploy.sh cvpap        # just one (also: resume, cards, nginx)
#   ./deploy.sh --no-pull    # rebuild what is already checked out
#
# Order is not arbitrary:
#   1. cvpap   — identity/data authority. Both other apps call /api/v1/cards/me,
#                so shipping a consumer first is how you get a 500 on a page
#                that worked yesterday.
#   2. resume  — runs database migrations ON BOOT (apps/server/src/startup/checks.ts).
#                Starting the container *is* migrating. Hence the dump below.
#   3. cards   — pure CVPAP frontend. NEXT_PUBLIC_* is baked at build time, so a
#                changed API URL needs a rebuild, not a restart.
set -euo pipefail

CVPAP_DIR="${CVPAP_DIR:-$HOME/Projects/CVPAP}"
RESUME_DIR="${RESUME_DIR:-$HOME/Projects/Reactive-Resume}"
CARDS_DIR="${CARDS_DIR:-$HOME/Projects/digital-business-cards}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/deploy-backups}"

PULL=1; TARGETS=()
for a in "$@"; do
  case "$a" in
    --no-pull) PULL=0 ;;
    cvpap|resume|cards|nginx) TARGETS+=("$a") ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done
[ ${#TARGETS[@]} -eq 0 ] && TARGETS=(cvpap resume cards nginx)

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m!!  %s\033[0m\n' "$*" >&2; exit 1; }

pull() {
  [ "$PULL" -eq 1 ] || return 0
  local dir=$1
  git -C "$dir" diff --quiet || fail "$dir has uncommitted changes — commit or stash before deploying"
  say "pulling $(basename "$dir")"
  git -C "$dir" pull --ff-only
}

# Wait for a health endpoint instead of assuming `up -d` means "serving".
wait_http() {
  local url=$1 name=$2
  for _ in $(seq 1 60); do
    if curl -fsS -m 3 -o /dev/null "$url"; then say "$name is up"; return 0; fi
    sleep 2
  done
  fail "$name did not come up at $url — check: docker compose logs --tail=80"
}

deploy_cvpap() {
  pull "$CVPAP_DIR"
  say "building + starting CVPAP"
  ( cd "$CVPAP_DIR" && docker compose build && docker compose up -d )
  # 401 means it is serving and demanding auth, which is exactly right here.
  for _ in $(seq 1 60); do
    code=$(curl -s -m 3 -o /dev/null -w '%{http_code}' http://127.0.0.1:5000/api/v1/cards/me || true)
    if [ "$code" = "401" ] || [ "$code" = "200" ]; then
      say "CVPAP is up (HTTP $code)"
      return 0
    fi
    sleep 2
  done
  fail "CVPAP did not come up on :5000"
}

deploy_resume() {
  pull "$RESUME_DIR"
  # Migrations run on boot and cannot be undone. Take the dump first.
  mkdir -p "$BACKUP_DIR"
  local dump="$BACKUP_DIR/resume-$(date +%Y%m%d-%H%M%S).sql"
  if [ -n "${RESUME_DATABASE_URL:-}" ]; then
    say "backing up the resume database -> $dump"
    pg_dump "$RESUME_DATABASE_URL" > "$dump" || fail "pg_dump failed — refusing to migrate without a backup"
  else
    echo "WARNING: RESUME_DATABASE_URL unset, skipping backup. The app migrates on boot." >&2
    read -rp "Continue without a backup? [y/N] " ok; [ "$ok" = "y" ] || exit 1
  fi
  say "building + starting Reactive Resume (migrates on boot)"
  ( cd "$RESUME_DIR" && docker compose build && docker compose up -d )
  wait_http http://127.0.0.1:3000/api/health "Reactive Resume"
}

deploy_cards() {
  pull "$CARDS_DIR"
  say "building + starting Cards & Print"
  ( cd "$CARDS_DIR" && docker compose build && docker compose up -d )
  wait_http http://127.0.0.1:7500/cards/login "Cards & Print"
}

reload_nginx() {
  say "validating nginx"
  sudo nginx -t || fail "nginx config is invalid — not reloading"
  sudo systemctl reload nginx
  say "nginx reloaded"
}

for t in "${TARGETS[@]}"; do
  case "$t" in
    cvpap)  deploy_cvpap  ;;
    resume) deploy_resume ;;
    cards)  deploy_cards  ;;
    nginx)  reload_nginx  ;;
  esac
done

say "done — https://cards.gidraf.dev"
