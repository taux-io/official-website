#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${DIR}/.."

npm run build:css
python3 "${DIR}/minify.py"
echo "Build complete: generated src/styles.min.css and src/script.min.js"

