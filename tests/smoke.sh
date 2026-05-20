#!/usr/bin/env bash
set -euo pipefail

ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT

export OPENARMY_HOME="$ROOT"

npm run build
node dist/index.js init >/dev/null
node dist/index.js run local-assistant --input '{"task":"smoke"}' >/dev/null
node dist/index.js tools >/dev/null
