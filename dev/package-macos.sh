#!/usr/bin/env bash
# Package an existing stable build for manual GitHub release uploads.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ "$(uname -s)" == Darwin ]] || { echo 'Requires macOS.' >&2; exit 1; }
arch="$(uname -m)"
[[ "$arch" != x86_64 ]] || arch=x64
source_app="$PWD/VSCode-darwin-${arch}/GucEdit.app"
version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$source_app/Contents/Info.plist")"
output_dir="$PWD/.gucedit-tools/releases"
output="$output_dir/GucEdit-${version}-macOS-${arch}.dmg"
[[ ! -e "$output" ]] || { echo "Already exists: $output" >&2; exit 1; }
mkdir -p "$output_dir"
stage="$(mktemp -d "${TMPDIR:-/tmp}/gucedit-package.XXXXXX")"
trap 'rm -rf "$stage"' EXIT
ditto "$source_app" "$stage/GucEdit.app"
ln -s /Applications "$stage/Applications"
# Seal the bundle for integrity; this is NOT Developer ID signing or notarization.
codesign --force --deep --sign - --preserve-metadata=entitlements "$stage/GucEdit.app"
codesign --verify --deep --strict "$stage/GucEdit.app"
"$stage/GucEdit.app/Contents/Resources/app/bin/gucedit" --version
hdiutil create -volname GucEdit -srcfolder "$stage" -format UDZO "$output"
hdiutil verify "$output"
cd "$output_dir"
shasum -a 256 "$(basename "$output")" > "$(basename "$output").sha256"
printf '\nRelease artifact: %s\n' "$output"
