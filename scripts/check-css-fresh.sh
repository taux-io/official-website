#!/bin/sh
# Fails if the committed stylesheet is not what the current sources build.
#
# static/css/styles.min.css is a build artifact under version control, and
# Tailwind generates it from the classes it finds in the templates. Editing a
# template after the last build therefore leaves the committed CSS silently
# short of a rule — which is exactly what happened when the tau curve band was
# added after a rebuild: .md\:h-20 never made it in, and the band rendered
# 16px short on all seven guide pages with nothing to indicate why.

set -e

# THE SUFFIX GOES INSIDE mktemp, NOT AFTER IT.
#
# This read `OUT="$(mktemp -t styles.XXXXXX).css"`, which reserved one path and
# then wrote to a different one — `.css` was appended after mktemp had already
# returned, so the file actually written was never reserved and never checked
# for existence. On a shared machine that is a symlink-clobber race (CWE-377,
# CWE-59), and the trap cleaned up the reserved name while leaking the one that
# had the real bytes in it.
OUT="$(mktemp -t styles.XXXXXX.css)"
trap 'rm -f "$OUT"' EXIT

npx tailwindcss -i ./src/input.css -o "$OUT" --minify >/dev/null 2>&1

if cmp -s "$OUT" static/css/styles.min.css; then
    echo "styles.min.css is up to date"
else
    echo "styles.min.css is stale — the templates have classes the committed build does not."
    echo "Run: npm run build:css"
    exit 1
fi
