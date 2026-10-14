#!/usr/bin/env bash
# Install an already-built stable macOS app and its command-line launcher.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'This installer is for macOS.' >&2
  exit 1
fi
arch="$(uname -m)"
[[ "$arch" != x86_64 ]] || arch=x64
source_app="$PWD/VSCode-darwin-${arch}/GucEdit.app"
target_app="${GUCEDIT_APPLICATIONS_DIR:-/Applications}/GucEdit.app"
cli_dir="${GUCEDIT_BIN_DIR:-$HOME/.local/bin}"
cli_target="$target_app/Contents/Resources/app/bin/gucedit"
if [[ ! -x "$source_app/Contents/Resources/app/bin/gucedit" ]]; then
  echo "Build GucEdit first; no app found at $source_app" >&2
  exit 1
fi
if [[ -e "$target_app" ]]; then
  echo "Quit GucEdit and move $target_app aside before installing a replacement." >&2
  exit 1
fi
if [[ -e "$cli_dir/gucedit" || -L "$cli_dir/gucedit" ]]; then
  if [[ ! -L "$cli_dir/gucedit" || "$(readlink "$cli_dir/gucedit")" != "$cli_target" ]]; then
    echo "Refusing to replace an unrelated command at $cli_dir/gucedit" >&2
    exit 1
  fi
fi
mkdir -p "$(dirname "$target_app")" "$cli_dir"
ditto "$source_app" "$target_app"
ln -sfn "$cli_target" "$cli_dir/gucedit"
"$cli_dir/gucedit" --version
printf '\nInstalled %s\nCLI: %s/gucedit\n' "$target_app" "$cli_dir"
case ":$PATH:" in
  *":$cli_dir:"*) ;;
  *) printf 'Add %s to your shell PATH.\n' "$cli_dir" ;;
esac
