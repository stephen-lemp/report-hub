#!/usr/bin/env bash
set -euo pipefail

# Force StandardJS to write its cache inside the repo so it works in sandboxed environments.
export XDG_CACHE_HOME="$PWD/.cache"

exec "$(dirname "$0")/../node_modules/.bin/standard" "$@"
