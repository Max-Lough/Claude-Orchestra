#!/usr/bin/env sh
# Orchestra installer wrapper — Codex-native (POSIX)
#   ./install-codex.sh /path/to/project
#   ./install-codex.sh /path/to/project --packs claude
#   ./install-codex.sh /path/to/project --uninstall
set -e
command -v node >/dev/null 2>&1 || {
  echo "ERROR: Node.js is required (used by the installer and the guard hook)." >&2
  exit 1
}
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec node "$DIR/install-codex.js" "$@"
