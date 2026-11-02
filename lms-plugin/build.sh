#!/usr/bin/env bash
# Builds an installable darts-lms-pro.zip (with the PDF library) into ./dist
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/darts-lms-pro"
OUT="$HERE/dist"
TMP="$(mktemp -d)"
mkdir -p "$OUT"
rsync -a --exclude vendor --exclude composer.lock --exclude '.git*' "$SRC/" "$TMP/darts-lms-pro/"
cp "$SRC/composer.lock" "$TMP/darts-lms-pro/" 2>/dev/null || true
( cd "$TMP/darts-lms-pro" && composer install --no-dev --prefer-dist --optimize-autoloader --quiet )
# Trim files a live site never needs.
find "$TMP/darts-lms-pro/vendor" -type d \( -iname tests -o -iname test -o -iname docs -o -iname doc -o -iname examples -o -name .github -o -name .git \) -prune -exec rm -rf {} +
find "$TMP/darts-lms-pro/vendor" -type f \( -iname '*.md' -o -name 'phpunit*' -o -name '.editorconfig' -o -name '.gitattributes' \) -delete
rm -f "$TMP/darts-lms-pro/composer.json" "$TMP/darts-lms-pro/composer.lock"
( cd "$TMP" && rm -f "$OUT/darts-lms-pro.zip" && zip -qr "$OUT/darts-lms-pro.zip" darts-lms-pro )
rm -rf "$TMP"
ls -lh "$OUT/darts-lms-pro.zip"
