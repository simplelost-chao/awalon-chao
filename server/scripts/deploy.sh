#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_HOST="${REMOTE_HOST:-15.135.140.253}"
REMOTE_PORT="${REMOTE_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/opt/avalon-online/server}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
DELETE_EXTRA="${DELETE_EXTRA:-1}"
REMOTE_CMD="${REMOTE_CMD:-}"
INCLUDE_DB="${INCLUDE_DB:-0}"
DRY_RUN=0

usage() {
  cat <<'EOH'
Usage: scripts/deploy.sh [options]

Sync server project to a remote host with rsync over SSH.

Options:
  --user <name>          Remote SSH user (default: root or $REMOTE_USER)
  --host <ip-or-domain>  Remote host (default: 15.135.140.253 or $REMOTE_HOST)
  --port <port>          Remote SSH port (default: 22 or $REMOTE_PORT)
  --dir <path>           Remote deploy path (default: /opt/avalon-online/server or $REMOTE_DIR)
  --key <path>           SSH private key path (default: ~/.ssh/id_ed25519 or $SSH_KEY)
  --remote-cmd <cmd>     Command to run on remote host after sync
  --include-db           Include *.sqlite and *-wal/*-shm files in sync
  --no-delete            Keep files on remote side that do not exist locally
  --dry-run              Preview sync result without uploading
  -h, --help             Show this help
EOH
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user) REMOTE_USER="$2"; shift 2 ;;
    --host) REMOTE_HOST="$2"; shift 2 ;;
    --port) REMOTE_PORT="$2"; shift 2 ;;
    --dir) REMOTE_DIR="$2"; shift 2 ;;
    --key) SSH_KEY="$2"; shift 2 ;;
    --remote-cmd) REMOTE_CMD="$2"; shift 2 ;;
    --include-db) INCLUDE_DB=1; shift ;;
    --no-delete) DELETE_EXTRA=0; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ ! -f "$SSH_KEY" ]]; then
  echo "SSH key not found: $SSH_KEY" >&2
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required but not installed." >&2
  exit 1
fi

SSH_CMD=(ssh -i "$SSH_KEY" -p "$REMOTE_PORT")

echo "==> Checking SSH connectivity"
"${SSH_CMD[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "echo connected >/dev/null"

echo "==> Ensuring remote directory: ${REMOTE_DIR}"
"${SSH_CMD[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p '$REMOTE_DIR'"

RSYNC_ARGS=(
  -az
  --progress
  --exclude ".git/"
  --exclude "node_modules/"
  --exclude ".DS_Store"
  --exclude "*.log"
  --exclude ".env"
  --exclude ".env.production"
  --exclude ".env*.local"
  --exclude "npm-debug.*"
  --exclude "yarn-error.*"
  --exclude "uploads/"
  --filter "P .env"
  --filter "P .env.production"
  --filter "P uploads/"
  -e "ssh -i $SSH_KEY -p $REMOTE_PORT"
)

if [[ "$INCLUDE_DB" != "1" ]]; then
  RSYNC_ARGS+=(
    --exclude "*.sqlite"
    --exclude "*.sqlite-wal"
    --exclude "*.sqlite-shm"
    --filter "P *.sqlite"
    --filter "P *.sqlite-wal"
    --filter "P *.sqlite-shm"
  )
fi

if [[ "$DELETE_EXTRA" == "1" ]]; then
  RSYNC_ARGS+=(--delete)
fi

if [[ "$DRY_RUN" == "1" ]]; then
  RSYNC_ARGS+=(--dry-run)
fi

echo "==> Syncing files to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}"
rsync "${RSYNC_ARGS[@]}" ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

if [[ -n "$REMOTE_CMD" ]]; then
  echo "==> Running remote command"
  "${SSH_CMD[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "$REMOTE_CMD"
fi

echo "==> Deploy finished"
