#!/usr/bin/env bash
#
# Off-server backups for the whole stack.
#
#   ./backup.sh                 # back up everything, upload, email a receipt
#   ./backup.sh postgres mongo  # only those components
#   ./backup.sh --no-upload     # write locally only (for testing)
#   ./backup.sh --prune-clickhouse   # after a successful ClickHouse upload,
#                                    # drop the old traces to reclaim disk
#
# Components: postgres  mongo  minio  clickhouse
#
# Why not email the archives themselves: Gmail rejects attachments over 25MB,
# and these run to gigabytes. Everything goes to Google Drive through rclone;
# the email is the receipt — what was taken, how big, its checksum, and where
# to find it. Restore with ./restore.sh.
#
# One-time setup on the server:
#   apt install -y rclone
#   rclone config        # create a remote named "gdrive" (Google Drive)
#   rclone lsd gdrive:   # confirm it works
set -uo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
STACK_ROOT="${STACK_ROOT:-/root/ajiriwa}"
[ -d "$STACK_ROOT" ] || STACK_ROOT="$HOME/Projects"

BACKUP_EMAIL="${BACKUP_EMAIL:-orenjagidraf@gmail.com}"
GDRIVE_REMOTE="${GDRIVE_REMOTE:-gdrive}"
GDRIVE_PATH="${GDRIVE_PATH:-ajiriwa-backups}"
# Staging lives on the big volume, not the root disk — these archives are large.
WORK_DIR="${WORK_DIR:-/mnt/HC_Volume_103347833/backup-staging}"
[ -d "$(dirname "$WORK_DIR")" ] || WORK_DIR="${TMPDIR:-/tmp}/backup-staging"
KEEP_REMOTE_DAYS="${KEEP_REMOTE_DAYS:-60}"

STAMP="$(date +%Y-%m-%d_%H%M)"
DEST="$WORK_DIR/$STAMP"
REMOTE_DIR="$GDRIVE_REMOTE:$GDRIVE_PATH/$STAMP"

UPLOAD=1
PRUNE_CLICKHOUSE=0
COMPONENTS=()
for a in "$@"; do
  case "$a" in
    --no-upload)        UPLOAD=0 ;;
    --prune-clickhouse) PRUNE_CLICKHOUSE=1 ;;
    postgres|mongo|minio|clickhouse) COMPONENTS+=("$a") ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done
[ ${#COMPONENTS[@]} -eq 0 ] && COMPONENTS=(postgres mongo minio clickhouse)

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m!!  %s\033[0m\n' "$*" >&2; }

mkdir -p "$DEST"

# Collected for the receipt: "name|status|size|sha256"
REPORT=()
FAILURES=0

record() { REPORT+=("$1|$2|$3|$4"); }

# Compress, checksum and record one finished dump.
finish_artifact() {
  local name=$1 path=$2
  if [ ! -s "$path" ]; then
    warn "$name produced nothing"
    record "$name" "FAILED" "-" "-"
    FAILURES=$((FAILURES + 1))
    return 1
  fi
  local size sha
  size=$(du -h "$path" | cut -f1)
  sha=$(sha256sum "$path" | cut -c1-16)
  record "$name" "OK" "$size" "$sha"
  say "$name -> $(basename "$path") ($size)"
}

# ── Postgres (runs on the VM, not in a container) ────────────────────────────
backup_postgres() {
  command -v pg_dump >/dev/null || { warn "pg_dump missing (apt install postgresql-client)"; record postgres FAILED - -; FAILURES=$((FAILURES+1)); return; }

  # Reuse the app's own connection string; host.docker.internal is a
  # container-only name, so rewrite it for this host.
  local url="${BACKUP_DATABASE_URL:-}"
  if [ -z "$url" ] && [ -f "$STACK_ROOT/Reactive-Resume/.env" ]; then
    url=$(grep -E '^[[:space:]]*(export[[:space:]]+)?DATABASE_URL=' "$STACK_ROOT/Reactive-Resume/.env" \
          | tail -1 | sed -E 's/^[[:space:]]*(export[[:space:]]+)?DATABASE_URL=//; s/^["'"'"']//; s/["'"'"']$//')
  fi
  [ -n "$url" ] || { warn "no DATABASE_URL found"; record postgres FAILED - -; FAILURES=$((FAILURES+1)); return; }
  url="${url//host.docker.internal/127.0.0.1}"

  say "dumping PostgreSQL"
  # -Fc is compressed and restores selectively with pg_restore.
  pg_dump -Fc "$url" > "$DEST/postgres.dump" 2>"$DEST/postgres.err" \
    || warn "pg_dump reported: $(tail -2 "$DEST/postgres.err" | tr '\n' ' ')"
  rm -f "$DEST/postgres.err"
  finish_artifact postgres "$DEST/postgres.dump"
}

# ── MongoDB (CVPAP container) ────────────────────────────────────────────────
backup_mongo() {
  local c
  c=$(docker ps --format '{{.Names}}' | grep -m1 'mongodb' || true)
  [ -n "$c" ] || { warn "no running mongodb container"; record mongo SKIPPED - -; return; }

  say "dumping MongoDB from $c"
  # Credentials come from the container's own environment, so they are never
  # written into this script.
  docker exec "$c" sh -c \
    'mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" \
       --authenticationDatabase admin --archive --gzip' \
    > "$DEST/mongo.archive.gz" 2>"$DEST/mongo.err" \
    || warn "mongodump reported: $(tail -2 "$DEST/mongo.err" | tr '\n' ' ')"
  rm -f "$DEST/mongo.err"
  finish_artifact mongo "$DEST/mongo.archive.gz"
}

# ── MinIO object storage ─────────────────────────────────────────────────────
backup_minio() {
  local dir="${MINIO_DATA_DIR:-}"
  if [ -z "$dir" ]; then
    for candidate in /mnt/HC_Volume_103347833/minio /data/minio /var/lib/minio /data; do
      [ -d "$candidate" ] && { dir="$candidate"; break; }
    done
  fi
  [ -n "$dir" ] && [ -d "$dir" ] || { warn "MinIO data dir not found (set MINIO_DATA_DIR)"; record minio SKIPPED - -; return; }

  say "archiving MinIO objects from $dir"
  tar -czf "$DEST/minio.tar.gz" -C "$(dirname "$dir")" "$(basename "$dir")" 2>/dev/null
  finish_artifact minio "$DEST/minio.tar.gz"
}

# ── ClickHouse (Langfuse traces) ─────────────────────────────────────────────
backup_clickhouse() {
  local c
  c=$(docker ps --format '{{.Names}}' | grep -m1 'clickhouse' || true)
  [ -n "$c" ] || { warn "no running clickhouse container"; record clickhouse SKIPPED - -; return; }

  say "exporting ClickHouse (Langfuse traces) from $c"
  # Native format keeps types and restores straight back with INSERT FROM INFILE.
  local tables
  tables=$(docker exec "$c" clickhouse-client --query \
    "SELECT name FROM system.tables WHERE database='default' AND engine NOT LIKE '%View%'" 2>/dev/null)
  [ -n "$tables" ] || { warn "could not list ClickHouse tables"; record clickhouse FAILED - -; FAILURES=$((FAILURES+1)); return; }

  mkdir -p "$DEST/clickhouse"
  local t
  for t in $tables; do
    docker exec "$c" clickhouse-client --query \
      "SELECT * FROM default.\`$t\` FORMAT Native" 2>/dev/null \
      | gzip > "$DEST/clickhouse/$t.native.gz"
  done
  tar -cf "$DEST/clickhouse.tar" -C "$DEST" clickhouse && rm -rf "$DEST/clickhouse"
  finish_artifact clickhouse "$DEST/clickhouse.tar"
}

# ── Upload ───────────────────────────────────────────────────────────────────
upload() {
  [ "$UPLOAD" -eq 1 ] || { warn "--no-upload: archives left in $DEST"; return 1; }
  command -v rclone >/dev/null || { warn "rclone missing — archives kept in $DEST"; return 1; }
  rclone listremotes 2>/dev/null | grep -q "^$GDRIVE_REMOTE:" \
    || { warn "rclone remote '$GDRIVE_REMOTE' not configured — run: rclone config"; return 1; }

  say "uploading to $REMOTE_DIR"
  rclone copy "$DEST" "$REMOTE_DIR" --transfers 2 --stats-one-line --stats 30s || return 1

  # Retention: old backups age out so Drive does not fill up either.
  rclone delete "$GDRIVE_REMOTE:$GDRIVE_PATH" --min-age "${KEEP_REMOTE_DAYS}d" 2>/dev/null || true
  rclone rmdirs "$GDRIVE_REMOTE:$GDRIVE_PATH" --leave-root 2>/dev/null || true
  return 0
}

# ── Email receipt ────────────────────────────────────────────────────────────
send_receipt() {
  local uploaded=$1
  local smtp_user="${ADMIN_EMAIL:-}" smtp_pass="${ADMIN_EMAIL_PASSWORD:-}"
  if [ -z "$smtp_user" ] && [ -f "$STACK_ROOT/CVPAP/.env" ]; then
    smtp_user=$(grep -E '^[[:space:]]*(export[[:space:]]+)?ADMIN_EMAIL=' "$STACK_ROOT/CVPAP/.env" | tail -1 | sed -E 's/.*ADMIN_EMAIL=//; s/^["'"'"']//; s/["'"'"']$//')
    smtp_pass=$(grep -E '^[[:space:]]*(export[[:space:]]+)?ADMIN_EMAIL_PASSWORD=' "$STACK_ROOT/CVPAP/.env" | tail -1 | sed -E 's/.*ADMIN_EMAIL_PASSWORD=//; s/^["'"'"']//; s/["'"'"']$//')
  fi

  local rows="" line name status size sha
  for line in "${REPORT[@]}"; do
    IFS='|' read -r name status size sha <<< "$line"
    rows="$rows  $(printf '%-12s %-8s %-8s %s' "$name" "$status" "$size" "$sha")"$'\n'
  done

  local where disk
  where=$([ "$uploaded" -eq 0 ] && echo "$REMOTE_DIR" || echo "NOT UPLOADED — still on the server at $DEST")
  disk=$(df -h "$WORK_DIR" 2>/dev/null | awk 'NR==2{print $4" free of "$2}')

  local subject="[Backup $( [ $FAILURES -eq 0 ] && echo OK || echo "$FAILURES FAILED" )] Ajiriwa stack — $STAMP"
  local body="Backup run $STAMP

Component   Status   Size     SHA256 (first 16)
$rows
Location: $where
Staging disk: $disk

Restore with:  ./deploy/restore.sh $STAMP
List backups:  rclone ls $GDRIVE_REMOTE:$GDRIVE_PATH

This is a receipt, not the backup itself — the archives are gigabytes and
Gmail rejects attachments over 25MB. Copy them from Drive to keep your own
offline copy."

  if [ -z "$smtp_user" ] || [ -z "$smtp_pass" ]; then
    warn "no ADMIN_EMAIL/ADMIN_EMAIL_PASSWORD — printing the receipt instead"
    printf '%s\n' "$body"
    return
  fi

  # curl speaks SMTP, so no mail transfer agent has to be installed.
  local mail_file="$DEST/receipt.eml"
  {
    printf 'From: %s\r\n' "$smtp_user"
    printf 'To: %s\r\n' "$BACKUP_EMAIL"
    printf 'Subject: %s\r\n' "$subject"
    printf 'Content-Type: text/plain; charset=utf-8\r\n\r\n'
    printf '%s\r\n' "$body"
  } > "$mail_file"

  if curl -s --ssl-reqd --url "smtps://smtp.gmail.com:465" \
       --user "$smtp_user:$smtp_pass" \
       --mail-from "$smtp_user" --mail-rcpt "$BACKUP_EMAIL" \
       --upload-file "$mail_file"; then
    say "receipt emailed to $BACKUP_EMAIL"
  else
    warn "could not send the receipt; it is at $mail_file"
  fi
  rm -f "$mail_file"
}

# ── Reclaim ClickHouse space (only after a verified upload) ──────────────────
prune_clickhouse() {
  [ "$PRUNE_CLICKHOUSE" -eq 1 ] || return 0
  local c
  c=$(docker ps --format '{{.Names}}' | grep -m1 'clickhouse' || true)
  [ -n "$c" ] || return 0
  if [ ! -s "$DEST/clickhouse.tar" ]; then
    warn "refusing to prune ClickHouse: no export was produced"
    return 0
  fi
  if [ "$1" -ne 0 ]; then
    warn "refusing to prune ClickHouse: the upload did not succeed"
    return 0
  fi

  say "truncating Langfuse trace tables (export is safely uploaded)"
  # Only the high-volume observability tables. Prompts and project config live
  # in Langfuse's PostgreSQL, not here, so they are untouched.
  local t
  for t in traces observations scores event_log; do
    docker exec "$c" clickhouse-client --query "TRUNCATE TABLE IF EXISTS default.\`$t\`" 2>/dev/null \
      && echo "  truncated $t"
  done
}

# ── Run ──────────────────────────────────────────────────────────────────────
for comp in "${COMPONENTS[@]}"; do
  case "$comp" in
    postgres)   backup_postgres ;;
    mongo)      backup_mongo ;;
    minio)      backup_minio ;;
    clickhouse) backup_clickhouse ;;
  esac
done

upload; uploaded=$?
send_receipt "$uploaded"
prune_clickhouse "$uploaded"

# Local staging is disposable once it is on Drive.
if [ "$uploaded" -eq 0 ]; then
  rm -rf "$DEST"
  say "done — uploaded and local staging cleared"
else
  warn "done — archives kept locally at $DEST"
fi

exit $([ $FAILURES -eq 0 ] && echo 0 || echo 1)
