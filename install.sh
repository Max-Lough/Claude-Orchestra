#!/usr/bin/env sh
# Orchestra installer wrapper (POSIX)
#   ./install.sh /path/to/project
#   ./install.sh /path/to/project --uninstall
#   ./install.sh --scan /path/to/code            report which installs are behind
#   ./install.sh --scan /path/to/code --update   ...and bring the stale ones up
set -e
command -v node >/dev/null 2>&1 || {
  echo "ERROR: Node.js is required (used by the installer and the guard hook)." >&2
  exit 1
}
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec node "$DIR/install.js" "$@"
