#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_HOST="${REMOTE_HOST:-15.135.140.253}"
REMOTE_PORT="${REMOTE_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/opt/avalon-online/mobile}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
DELETE_EXTRA="${DELETE_EXTRA:-1}"
REMOTE_CMD="${REMOTE_CMD:-}"
PROD_MODE=0
PM2_NAME="${PM2_NAME:-awalon-web}"
APP_PORT="${APP_PORT:-3000}"
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: scripts/deploy.sh [options]

Sync current project to a remote server through rsync over SSH.
Use --prod for one-command deploy that also builds and restarts PM2 on server.

Options:
  --user <name>          Remote SSH user (default: root or $REMOTE_USER)
  --host <ip-or-domain>  Remote host (default: 15.135.140.253 or $REMOTE_HOST)
  --port <port>          Remote SSH port (default: 22 or $REMOTE_PORT)
  --dir <path>           Remote deploy path (default: /opt/avalon-online/mobile or $REMOTE_DIR)
  --key <path>           SSH private key path (default: ~/.ssh/id_ed25519 or $SSH_KEY)
  --remote-cmd <cmd>     Command to run on remote host after sync
  --prod                 Run production deploy steps on remote host after sync
  --pm2-name <name>      PM2 process name in --prod mode (default: awalon-web)
  --app-port <port>      App port for serve in --prod mode (default: 3000)
  --no-delete            Keep files on remote side that do not exist locally
  --dry-run              Show what would change without uploading files
  -h, --help             Show this help

Examples:
  scripts/deploy.sh --user root --host 15.135.140.253 --dir /opt/avalon-online/mobile
  scripts/deploy.sh --prod
  scripts/deploy.sh --prod --pm2-name awalon-web --app-port 3000
  scripts/deploy.sh --remote-cmd "cd /opt/avalon-online/mobile && npm ci && pm2 restart avalon-mobile"
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user)
      REMOTE_USER="$2"
      shift 2
      ;;
    --host)
      REMOTE_HOST="$2"
      shift 2
      ;;
    --port)
      REMOTE_PORT="$2"
      shift 2
      ;;
    --dir)
      REMOTE_DIR="$2"
      shift 2
      ;;
    --key)
      SSH_KEY="$2"
      shift 2
      ;;
    --remote-cmd)
      REMOTE_CMD="$2"
      shift 2
      ;;
    --prod)
      PROD_MODE=1
      shift
      ;;
    --pm2-name)
      PM2_NAME="$2"
      shift 2
      ;;
    --app-port)
      APP_PORT="$2"
      shift 2
      ;;
    --no-delete)
      DELETE_EXTRA=0
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
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
  --exclude ".expo/"
  --exclude "dist/"
  --exclude ".DS_Store"
  --exclude "*.log"
  --exclude ".env*.local"
  --exclude "npm-debug.*"
  --exclude "yarn-error.*"
  -e "ssh -i $SSH_KEY -p $REMOTE_PORT"
)

if [[ "$DELETE_EXTRA" == "1" ]]; then
  RSYNC_ARGS+=(--delete)
fi

if [[ "$DRY_RUN" == "1" ]]; then
  RSYNC_ARGS+=(--dry-run)
fi

echo "==> Syncing files to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}"
rsync "${RSYNC_ARGS[@]}" ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

if [[ "$PROD_MODE" == "1" ]]; then
  read -r -d '' PROD_REMOTE_CMD <<EOF || true
set -euo pipefail
cd '${REMOTE_DIR}'
npm install --omit=dev --no-fund --no-audit
npx expo export --platform web
mkdir -p dist/mp-assets
rsync -a --delete assets/ dist/mp-assets/
if ! command -v pm2 >/dev/null 2>&1; then npm install -g pm2; fi
if ! command -v serve >/dev/null 2>&1; then npm install -g serve; fi
if pm2 describe '${PM2_NAME}' >/dev/null 2>&1; then
  pm2 restart '${PM2_NAME}'
else
  pm2 start "serve -s dist -l ${APP_PORT}" --name '${PM2_NAME}'
fi
pm2 save
EOF
  if [[ -n "$REMOTE_CMD" ]]; then
    REMOTE_CMD="${REMOTE_CMD}"$'\n'"${PROD_REMOTE_CMD}"
  else
    REMOTE_CMD="${PROD_REMOTE_CMD}"
  fi
fi

if [[ -n "$REMOTE_CMD" ]]; then
  echo "==> Running remote command"
  "${SSH_CMD[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "$REMOTE_CMD"
fi

echo "==> Deploy finished"
