#!/usr/bin/env bash
set -euo pipefail

# OpenArmy bootstrap installer
# Usage: curl -fsSL https://friday.example.com/install.sh | bash
# Idempotent — safe to re-run for upgrades or repairs.

PACKAGE_NAME="@hb_army/openarmy"
OPENARMY_HOME="${OPENARMY_HOME:-$HOME/.openarmy}"
OPENARMY_BIN="${OPENARMY_BIN:-/usr/local/bin}"
MIN_NODE_MAJOR=18

# ── helpers ────────────────────────────────────────────────────────────────────

log()  { printf '\033[1;34m[openarmy]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[openarmy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[openarmy]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[openarmy]\033[0m ERROR: %s\n' "$*" >&2; exit 1; }

# ── platform detection ─────────────────────────────────────────────────────────

detect_platform() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Linux)  PLATFORM="linux" ;;
    Darwin) PLATFORM="darwin" ;;
    MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
    *) die "Unsupported operating system: $os" ;;
  esac

  case "$arch" in
    x86_64|amd64) ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    armv7l) ARCH="arm" ;;
    *) warn "Unrecognised CPU architecture: $arch — proceeding anyway" ;;
  esac

  log "Platform: $PLATFORM/$ARCH"
}

# ── node requirement ──────────────────────────────────────────────────────────

check_node() {
  if ! command -v node >/dev/null 2>&1; then
    die "Node.js >= $MIN_NODE_MAJOR is required but was not found. Install it from https://nodejs.org"
  fi

  local node_version major
  node_version="$(node --version)"        # e.g. v20.11.0
  major="${node_version#v}"
  major="${major%%.*}"

  if [ "$major" -lt "$MIN_NODE_MAJOR" ]; then
    die "Node.js $MIN_NODE_MAJOR+ required; found $node_version. Upgrade at https://nodejs.org"
  fi

  log "Node.js $node_version — OK"
}

check_npm() {
  if ! command -v npm >/dev/null 2>&1; then
    die "npm is required but was not found."
  fi
  log "npm $(npm --version) — OK"
}

# ── install / upgrade ─────────────────────────────────────────────────────────

install_package() {
  log "Installing $PACKAGE_NAME …"
  if npm install -g "$PACKAGE_NAME" 2>&1; then
    ok "$PACKAGE_NAME installed"
  else
    die "npm install -g $PACKAGE_NAME failed. Check npm permissions or use a Node version manager."
  fi
}

# ── directory structure ───────────────────────────────────────────────────────

create_directories() {
  log "Creating workspace under $OPENARMY_HOME …"
  for dir in \
    "$OPENARMY_HOME" \
    "$OPENARMY_HOME/agents" \
    "$OPENARMY_HOME/registry" \
    "$OPENARMY_HOME/scheduler" \
    "$OPENARMY_HOME/skills"; do
    mkdir -p "$dir"
  done
  ok "Directories ready"
}

# ── default config ────────────────────────────────────────────────────────────

write_default_config() {
  local config_file="$OPENARMY_HOME/config.json"
  if [ -f "$config_file" ]; then
    log "Config already exists — skipping write ($config_file)"
    return
  fi

  log "Writing default config …"
  cat > "$config_file" <<JSON
{
  "workspaceRoot": "$OPENARMY_HOME",
  "gateway": {
    "host": "127.0.0.1",
    "port": 4737
  },
  "scheduler": {
    "enabled": true
  },
  "heartbeat": {
    "intervalMs": 15000,
    "timeoutMs": 60000
  },
  "logLevel": "info",
  "skillDirectories": ["$OPENARMY_HOME/skills"],
  "providers": [
    {
      "id": "local",
      "type": "local",
      "auth": { "method": "none" },
      "models": ["local-runtime"],
      "defaultModel": "local-runtime",
      "timeoutMs": 30000,
      "retryPolicy": { "retries": 0, "backoffMs": 0 }
    }
  ]
}
JSON
  ok "Config written to $config_file"
}

# ── validate install ──────────────────────────────────────────────────────────

validate_install() {
  log "Validating CLI …"
  if ! command -v oa >/dev/null 2>&1; then
    warn "'oa' command not found in PATH. You may need to add npm global bin to your PATH:"
    warn "  $(npm bin -g 2>/dev/null || echo '<npm global bin>')"
    return
  fi

  if OPENARMY_HOME="$OPENARMY_HOME" oa --version >/dev/null 2>&1; then
    ok "CLI validated: $(oa --version)"
  else
    warn "oa --version failed — check the installation"
  fi
}

# ── register starter agent ────────────────────────────────────────────────────

register_starter_agent() {
  if ! command -v oa >/dev/null 2>&1; then
    return
  fi

  log "Initialising default agent …"
  if OPENARMY_HOME="$OPENARMY_HOME" oa init >/dev/null 2>&1; then
    ok "Default agent registered"
  else
    warn "oa init returned non-zero — the agent may already exist"
  fi
}

# ── main ──────────────────────────────────────────────────────────────────────

main() {
  echo ""
  echo "  ██████╗ ██████╗ ███████╗███╗   ██╗ █████╗ ██████╗ ███╗   ███╗██╗   ██╗"
  echo " ██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔══██╗██╔══██╗████╗ ████║╚██╗ ██╔╝"
  echo " ██║   ██║██████╔╝█████╗  ██╔██╗ ██║███████║██████╔╝██╔████╔██║ ╚████╔╝ "
  echo " ██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██╔══██║██╔══██╗██║╚██╔╝██║  ╚██╔╝  "
  echo " ╚██████╔╝██║     ███████╗██║ ╚████║██║  ██║██║  ██║██║ ╚═╝ ██║   ██║   "
  echo "  ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝   ╚═╝  "
  echo ""
  log "Agentic AI runtime installer"
  echo ""

  detect_platform
  check_node
  check_npm
  install_package
  create_directories
  write_default_config
  validate_install
  register_starter_agent

  echo ""
  ok "OpenArmy installed successfully."
  echo ""
  echo "  Start the HTTP server:   oa serve"
  echo "  Start in dev mode:       npm run dev   (from the project root)"
  echo "  List agents:             oa agents"
  echo "  Run an agent:            oa run local-assistant"
  echo "  Workspace:               $OPENARMY_HOME"
  echo ""
}

main "$@"
