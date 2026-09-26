#!/usr/bin/env bash
#
# Deploy the cards.gidraf.dev stack.
#
#   ./deploy.sh              # all three, in dependency order
#   ./deploy.sh cvpap        # just one (also: resume, cards, nginx)
#   ./deploy.sh --no-pull    # rebuild what is already checked out
#   ./deploy.sh bootstrap    # ONE TIME on a new server: install nginx site + TLS
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
    cvpap|resume|cards|nginx|bootstrap) TARGETS+=("$a") ;;
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
  # Fall back to the app's own .env so this works without exporting anything.
  if [ -z "${RESUME_DATABASE_URL:-}" ] && [ -f "$RESUME_DIR/.env" ]; then
    RESUME_DATABASE_URL=$(grep -E '^[[:space:]]*(export[[:space:]]+)?DATABASE_URL=' "$RESUME_DIR/.env" \
      | tail -1 | sed -E 's/^[[:space:]]*(export[[:space:]]+)?DATABASE_URL=//; s/^["'"'"']//; s/["'"'"']$//')
    [ -n "$RESUME_DATABASE_URL" ] && say "using DATABASE_URL from $RESUME_DIR/.env"
  fi
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

# One-time server setup: install the nginx site and obtain TLS.
# Safe to re-run — every step checks for what it already did.
bootstrap_nginx() {
  local conf="$CARDS_DIR/deploy/nginx/cards.gidraf.dev.conf"
  local name=cards.gidraf.dev.conf
  local site="/etc/nginx/sites-available/$name"
  local link="/etc/nginx/sites-enabled/$name"
  [ -f "$conf" ] || fail "missing $conf"

  # An extensionless copy from an earlier setup would be loaded as well, giving
  # nginx duplicate server blocks and a duplicate $connection_upgrade map.
  local legacy=/etc/nginx/sites-available/cards.gidraf.dev
  if sudo test -e "$legacy"; then
    fail "a second copy exists at $legacy — remove it and its sites-enabled symlink, or nginx will load this site twice"
  fi

  # certbot appends the 443 block and the http->https redirect to this file, so
  # overwriting it drops TLS. Keep a copy, and note whether TLS was configured.
  local had_tls=0
  if sudo test -f "$site"; then
    local backup="$site.bak-$(date +%Y%m%d-%H%M%S)"
    sudo cp "$site" "$backup"
    say "backed up the existing site -> $backup"
    if sudo grep -qE 'listen[[:space:]]+443|ssl_certificate' "$site"; then had_tls=1; fi
  fi

  say "installing the nginx site"
  sudo cp "$conf" "$site"
  [ -L "$link" ] || sudo ln -s "$site" "$link"
  sudo mkdir -p /var/www/html/.well-known/acme-challenge

  if [ "$(grep -rl 'map \$http_upgrade \$connection_upgrade' /etc/nginx/sites-enabled/ 2>/dev/null | wc -l)" -gt 1 ]; then
    fail "another enabled site already defines the \$connection_upgrade map — delete the map block at the end of $site (nginx refuses duplicate map names)"
  fi

  sudo nginx -t || fail "nginx config is invalid — restore the backup above, or fix $site"
  sudo systemctl reload nginx
  say "nginx site is live over HTTP"

  # The freshly copied file is HTTP-only. Re-run certbot when TLS was already
  # set up (it reuses the existing certificate and re-adds the 443 block), or
  # when there is no certificate yet.
  if [ "$had_tls" -eq 1 ]; then
    say "the previous config had TLS — reinstalling it onto the new file"
    sudo certbot --nginx -d cards.gidraf.dev --reinstall
  elif sudo test -d /etc/letsencrypt/live/cards.gidraf.dev; then
    say "certificate exists but the site is HTTP-only — installing it"
    sudo certbot --nginx -d cards.gidraf.dev --reinstall
  else
    command -v certbot >/dev/null || fail "certbot is not installed: sudo apt install -y certbot python3-certbot-nginx"
    say "requesting a certificate (certbot adds the 443 block and the redirect)"
    sudo certbot --nginx -d cards.gidraf.dev
  fi

  sudo nginx -t && sudo systemctl reload nginx
  say "bootstrap complete — https://cards.gidraf.dev"
}

for t in "${TARGETS[@]}"; do
  case "$t" in
    cvpap)  deploy_cvpap  ;;
    resume) deploy_resume ;;
    cards)  deploy_cards  ;;
    nginx)  reload_nginx  ;;
    bootstrap) bootstrap_nginx ;;
  esac
done

say "done — https://cards.gidraf.dev"
