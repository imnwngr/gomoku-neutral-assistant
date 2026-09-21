#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
output_dir="$project_dir/dist"
archive="$project_dir/gomoku-neutral-assistant-v0.1.0.zip"

rm -rf "$output_dir"
mkdir -p "$output_dir"
cp -R \
  "$project_dir/background" \
  "$project_dir/content" \
  "$project_dir/engine" \
  "$project_dir/offscreen" \
  "$project_dir/popup" \
  "$project_dir/shared" \
  "$project_dir/third_party" \
  "$output_dir/"
cp "$project_dir/manifest.json" "$project_dir/LICENSE" "$output_dir/"

rm -f "$archive"
(cd "$output_dir" && zip -q -r "$archive" .)
echo "$archive"
