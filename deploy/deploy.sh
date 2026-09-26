#!/usr/bin/env bash
#
# Deploy the cards.gidraf.dev stack.
#
#   ./deploy.sh              # all three, in dependency order
#   ./deploy.sh cvpap        # just one (also: resume, cards, nginx)
#   ./deploy.sh --no-pull    # rebuild what is already checked out
#   ./deploy.sh bootstrap    # ONE TIME on a new server: install nginx site + TLS
#
# Checkouts are found under STACK_ROOT (default /root/ajiriwa, falling back to
# ~/Projects) by matching each repo's origin remote, so folder naming does not
# matter. Override with CVPAP_DIR / RESUME_DIR / CARDS_DIR. Runs without sudo
# when already root.
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

# Where the three checkouts live on this machine. Folder names vary between the
# server and a laptop, so each repo is located by its origin remote rather than
# by a guessed directory name; set the *_DIR variables to override.
STACK_ROOT="${STACK_ROOT:-/root/ajiriwa}"
[ -d "$STACK_ROOT" ] || STACK_ROOT="$HOME/Projects"
BACKUP_DIR="${BACKUP_DIR:-$STACK_ROOT/deploy-backups}"

# Run without $SUDO when already root — minimal server images often lack it.
SUDO="${SUDO-sudo}"
[ "$(id -u)" -eq 0 ] && SUDO=""
command -v $SUDO >/dev/null || SUDO=""

find_repo() {
  local want=$1 d url
  for d in "$STACK_ROOT"/*/; do
    [ -e "$d/.git" ] || continue
    url=$(git -C "$d" remote get-url origin 2>/dev/null) || continue
    case "$(printf '%s' "$url" | tr 'A-Z' 'a-z')" in
      *"$(printf '%s' "$want" | tr 'A-Z' 'a-z')"*) printf '%s' "${d%/}"; return 0 ;;
    esac
  done
  return 1
}

CVPAP_DIR="${CVPAP_DIR:-$(find_repo CVPAP || true)}"
RESUME_DIR="${RESUME_DIR:-$(find_repo Reactive-Resume || true)}"
CARDS_DIR="${CARDS_DIR:-$(find_repo digital-business-cards || true)}"

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

need_dir() {
  [ -n "$2" ] && [ -d "$2" ] || fail "could not find the $1 checkout under $STACK_ROOT — set ${1}_DIR=/path/to/repo"
}

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
  need_dir CVPAP "$CVPAP_DIR"
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
  need_dir RESUME "$RESUME_DIR"
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
    # host.docker.internal is a container-only name: it means "the host", so
    # from the host itself the same database is on the loopback address.
    # pg_dump runs here, not in a container, so translate it.
    local dump_url="${RESUME_DATABASE_URL//host.docker.internal/127.0.0.1}"
    [ "$dump_url" != "$RESUME_DATABASE_URL" ] && say "host.docker.internal -> 127.0.0.1 for the host-side dump"

    command -v pg_dump >/dev/null || fail "pg_dump is not installed: apt install -y postgresql-client"
    say "backing up the resume database -> $dump"
    if ! pg_dump "$dump_url" > "$dump" 2>"$dump.err"; then
      echo "--- pg_dump error ---" >&2; cat "$dump.err" >&2
      rm -f "$dump" "$dump.err"
      fail "pg_dump failed — refusing to migrate without a backup. Set RESUME_DATABASE_URL to a URL reachable from this host and re-run."
    fi
    rm -f "$dump.err"
  else
    echo "WARNING: RESUME_DATABASE_URL unset, skipping backup. The app migrates on boot." >&2
    read -rp "Continue without a backup? [y/N] " ok; [ "$ok" = "y" ] || exit 1
  fi
  say "building + starting Reactive Resume (migrates on boot)"
  ( cd "$RESUME_DIR" && docker compose build && docker compose up -d )
  wait_http http://127.0.0.1:3000/api/health "Reactive Resume"
}

deploy_cards() {
  need_dir CARDS "$CARDS_DIR"
  pull "$CARDS_DIR"
  say "building + starting Cards & Print"
  ( cd "$CARDS_DIR" && docker compose build && docker compose up -d )
  wait_http http://127.0.0.1:7500/cards/login "Cards & Print"
}

reload_nginx() {
  say "validating nginx"
  $SUDO nginx -t || fail "nginx config is invalid — not reloading"
  $SUDO systemctl reload nginx
  say "nginx reloaded"
}

# One-time server setup: install the nginx site and obtain TLS.
# Safe to re-run — every step checks for what it already did.
bootstrap_nginx() {
  need_dir CARDS "$CARDS_DIR"
  local conf="$CARDS_DIR/deploy/nginx/cards.gidraf.dev.conf"
  [ -f "$conf" ] || fail "missing $conf"
  # Overridable so the bootstrap can be exercised against a fake tree in tests.
  local avail="${NGINX_AVAIL:-/etc/nginx/sites-available}"
  local enabled="${NGINX_ENABLED:-/etc/nginx/sites-enabled}"
  local le_live="${LETSENCRYPT_LIVE:-/etc/letsencrypt/live}"
  local acme_root="${ACME_ROOT:-/var/www/html/.well-known/acme-challenge}"
  local site link

  # Two names are possible: cards.gidraf.dev and cards.gidraf.dev.conf. Rather
  # than guessing by extension, adopt whichever one nginx is actually serving —
  # the sites-enabled symlink is the ground truth, and the live file is the one
  # holding certbot's 443 block.
  local e_conf=0 e_bare=0
  $SUDO test -e "$enabled/cards.gidraf.dev.conf" && e_conf=1
  $SUDO test -e "$enabled/cards.gidraf.dev"      && e_bare=1

  if [ $e_conf -eq 1 ] && [ $e_bare -eq 1 ]; then
    fail "both cards.gidraf.dev and cards.gidraf.dev.conf are enabled in $enabled — nginx is loading this site twice. Inspect both, keep the one with the 443 block, and remove the other symlink."
  elif [ $e_bare -eq 1 ]; then
    site="$avail/cards.gidraf.dev"; link="$enabled/cards.gidraf.dev"
    say "adopting the live site (no .conf extension): $site"
  else
    site="$avail/cards.gidraf.dev.conf"; link="$enabled/cards.gidraf.dev.conf"
  fi

  # A copy under the other name is only a problem once it is enabled; say so and
  # carry on rather than refusing to deploy.
  local other="$avail/cards.gidraf.dev.conf"
  [ "$site" = "$other" ] && other="$avail/cards.gidraf.dev"
  if $SUDO test -e "$other"; then
    echo "NOTE: an unused copy sits at $other (not enabled, so nginx ignores it). Delete it when convenient." >&2
  fi

  # certbot appends the 443 block and the http->https redirect to the installed
  # file, so copying the repo's HTTP-only version over it drops TLS. Keep a copy
  # and remember whether TLS was configured, so it can be put back.
  local had_tls=0 backup=""
  if $SUDO test -f "$site"; then
    backup="$site.bak-$(date +%Y%m%d-%H%M%S)"
    $SUDO cp "$site" "$backup"
    say "backed up the existing site -> $backup"
    if $SUDO grep -qE 'listen[[:space:]]+443|ssl_certificate' "$site"; then had_tls=1; fi
  fi

  say "installing the nginx site"
  $SUDO cp "$conf" "$site"
  [ -L "$link" ] || $SUDO ln -s "$site" "$link"
  $SUDO mkdir -p "$acme_root"

  if [ "$(grep -rl 'map \$http_upgrade \$connection_upgrade' "$enabled"/ 2>/dev/null | wc -l)" -gt 1 ]; then
    fail "another enabled site already defines the \$connection_upgrade map — delete the map block at the end of $site (nginx refuses duplicate map names)"
  fi

  if ! $SUDO nginx -t; then
    if [ -n "$backup" ]; then
      $SUDO cp "$backup" "$site"
      $SUDO nginx -t >/dev/null 2>&1 && $SUDO systemctl reload nginx
      fail "the new config did not validate — restored $backup and left nginx on it"
    fi
    fail "nginx config is invalid; fix $site"
  fi

  # The file just copied in is HTTP-only. When TLS was already set up, put it
  # back BEFORE reloading, so the site is never served without HTTPS. certbot
  # edits the file and reloads nginx itself.
  if [ "$had_tls" -eq 1 ] || $SUDO test -d "$le_live/cards.gidraf.dev"; then
    command -v certbot >/dev/null || fail "certbot is not installed, and $site currently has no TLS: restore $backup or run: sudo apt install -y certbot python3-certbot-nginx"
    say "restoring TLS onto the new config"
    $SUDO certbot --nginx -d cards.gidraf.dev --reinstall
  else
    $SUDO systemctl reload nginx
    say "nginx site is live over HTTP"
    command -v certbot >/dev/null || fail "certbot is not installed: sudo apt install -y certbot python3-certbot-nginx"
    say "requesting a certificate (certbot adds the 443 block and the redirect)"
    $SUDO certbot --nginx -d cards.gidraf.dev
  fi

  $SUDO nginx -t && $SUDO systemctl reload nginx
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
