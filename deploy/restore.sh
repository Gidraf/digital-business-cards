#!/usr/bin/env bash
#
# Restore from a backup made by backup.sh.
#
#   ./restore.sh                          # list what is on Google Drive
#   ./restore.sh 2026-09-26_1430          # restore everything from that run
#   ./restore.sh 2026-09-26_1430 postgres # restore one component
#   ./restore.sh --from-dir /path/to/dir  # restore from local files instead
#
# Restoring overwrites live data, so every component asks first. Nothing is
# touched until you type the confirmation word.
set -uo pipefail

STACK_ROOT="${STACK_ROOT:-/root/ajiriwa}"
[ -d "$STACK_ROOT" ] || STACK_ROOT="$HOME/Projects"
GDRIVE_REMOTE="${GDRIVE_REMOTE:-gdrive}"
GDRIVE_PATH="${GDRIVE_PATH:-ajiriwa-backups}"
WORK_DIR="${WORK_DIR:-/mnt/HC_Volume_103347833/backup-staging}"
[ -d "$(dirname "$WORK_DIR")" ] || WORK_DIR="${TMPDIR:-/tmp}/backup-staging"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!!  %s\033[0m\n' "$*" >&2; }
fail() { printf '\n\033[1;31m!!  %s\033[0m\n' "$*" >&2; exit 1; }

confirm() {
  local what=$1
  printf '\n\033[1;31mThis overwrites the live %s.\033[0m Type RESTORE to continue: ' "$what"
  read -r reply
  [ "$reply" = "RESTORE" ] || { warn "skipped $what"; return 1; }
  return 0
}

STAMP=""; FROM_DIR=""; COMPONENTS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --from-dir) FROM_DIR="${2:-}"; shift 2 ;;
    postgres|mongo|minio|clickhouse) COMPONENTS+=("$1"); shift ;;
    *) STAMP="$1"; shift ;;
  esac
done
[ ${#COMPONENTS[@]} -eq 0 ] && COMPONENTS=(postgres mongo minio clickhouse)

# No arguments: show what can be restored.
if [ -z "$STAMP" ] && [ -z "$FROM_DIR" ]; then
  command -v rclone >/dev/null || fail "rclone is not installed"
  say "backups on $GDRIVE_REMOTE:$GDRIVE_PATH"
  rclone lsd "$GDRIVE_REMOTE:$GDRIVE_PATH" 2>/dev/null | awk '{print "  "$NF}' || warn "none found"
  echo
  echo "  Restore with: ./restore.sh <name> [component ...]"
  exit 0
fi

SRC="$FROM_DIR"
if [ -z "$SRC" ]; then
  command -v rclone >/dev/null || fail "rclone is not installed"
  SRC="$WORK_DIR/restore-$STAMP"
  mkdir -p "$SRC"
  say "downloading $STAMP from Google Drive"
  rclone copy "$GDRIVE_REMOTE:$GDRIVE_PATH/$STAMP" "$SRC" --stats-one-line --stats 30s \
    || fail "download failed"
fi
[ -d "$SRC" ] || fail "no such directory: $SRC"
say "restoring from $SRC"
ls -lh "$SRC" | tail -n +2 | awk '{print "  "$9"  "$5}'

restore_postgres() {
  [ -f "$SRC/postgres.dump" ] || { warn "no postgres.dump in this backup"; return; }
  command -v pg_restore >/dev/null || fail "pg_restore missing (apt install postgresql-client)"
  local url="${BACKUP_DATABASE_URL:-}"
  if [ -z "$url" ] && [ -f "$STACK_ROOT/Reactive-Resume/.env" ]; then
    url=$(grep -E '^[[:space:]]*(export[[:space:]]+)?DATABASE_URL=' "$STACK_ROOT/Reactive-Resume/.env" \
          | tail -1 | sed -E 's/^[[:space:]]*(export[[:space:]]+)?DATABASE_URL=//; s/^["'"'"']//; s/["'"'"']$//')
  fi
  [ -n "$url" ] || fail "no DATABASE_URL to restore into"
  url="${url//host.docker.internal/127.0.0.1}"

  confirm "PostgreSQL database" || return
  say "restoring PostgreSQL"
  # --clean drops objects first; without it a restore onto a populated database
  # fails on every existing table.
  pg_restore --clean --if-exists --no-owner --dbname "$url" "$SRC/postgres.dump" \
    || warn "pg_restore finished with errors (often harmless: objects that did not exist)"
}

restore_mongo() {
  [ -f "$SRC/mongo.archive.gz" ] || { warn "no mongo archive in this backup"; return; }
  local c; c=$(docker ps --format '{{.Names}}' | grep -m1 'mongodb' || true)
  [ -n "$c" ] || { warn "no running mongodb container"; return; }
  confirm "MongoDB data" || return
  say "restoring MongoDB into $c"
  docker exec -i "$c" sh -c \
    'mongorestore --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" \
       --authenticationDatabase admin --archive --gzip --drop' \
    < "$SRC/mongo.archive.gz" || warn "mongorestore reported errors"
}

restore_minio() {
  [ -f "$SRC/minio.tar.gz" ] || { warn "no minio archive in this backup"; return; }
  local dir="${MINIO_DATA_DIR:-}"
  if [ -z "$dir" ]; then
    for c in /mnt/HC_Volume_103347833/minio /data/minio /var/lib/minio /data; do
      [ -d "$c" ] && { dir="$c"; break; }
    done
  fi
  [ -n "$dir" ] || fail "MinIO data dir not found (set MINIO_DATA_DIR)"
  confirm "MinIO object store at $dir" || return
  say "restoring MinIO objects"
  tar -xzf "$SRC/minio.tar.gz" -C "$(dirname "$dir")" || warn "extract reported errors"
}

restore_clickhouse() {
  [ -f "$SRC/clickhouse.tar" ] || { warn "no clickhouse archive in this backup"; return; }
  local c; c=$(docker ps --format '{{.Names}}' | grep -m1 'clickhouse' || true)
  [ -n "$c" ] || { warn "no running clickhouse container"; return; }
  confirm "ClickHouse trace tables" || return
  say "restoring ClickHouse"
  local tmp="$SRC/ch-extract"
  rm -rf "$tmp"; mkdir -p "$tmp"
  tar -xf "$SRC/clickhouse.tar" -C "$tmp"
  local f t
  for f in "$tmp"/clickhouse/*.native.gz; do
    [ -e "$f" ] || continue
    t=$(basename "$f" .native.gz)
    gunzip -c "$f" | docker exec -i "$c" clickhouse-client \
      --query "INSERT INTO default.\`$t\` FORMAT Native" 2>/dev/null \
      && echo "  restored $t" || warn "could not restore $t"
  done
  rm -rf "$tmp"
}

for comp in "${COMPONENTS[@]}"; do
  case "$comp" in
    postgres)   restore_postgres ;;
    mongo)      restore_mongo ;;
    minio)      restore_minio ;;
    clickhouse) restore_clickhouse ;;
  esac
done

say "restore finished — check the apps before assuming success"
