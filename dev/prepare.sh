#!/usr/bin/env bash
# Fetch and patch sources without downloading dependencies or compiling.
set -eo pipefail
cd "$(dirname "$0")/.."
. branding/environment.sh
export CI_BUILD=no VSCODE_QUALITY="${VSCODE_QUALITY:-stable}" GUCEDIT_PREPARE_ONLY=yes
export MAX_OLD_SPACE_SIZE=8192
case "${OSTYPE}" in darwin*) export OS_NAME=osx;; msys*|cygwin*) export OS_NAME=windows;; *) export OS_NAME=linux;; esac
if [[ -d vscode ]]; then
  echo 'vscode/ already exists; preserve your edits. Move it aside before preparing fresh sources.' >&2
  exit 1
fi
. get_repo.sh
. version.sh
printf 'MS_TAG="%s"\nMS_COMMIT="%s"\nRELEASE_VERSION="%s"\nBUILD_SOURCEVERSION="%s"\n' "$MS_TAG" "$MS_COMMIT" "$RELEASE_VERSION" "$BUILD_SOURCEVERSION" > dev/build.env
. prepare_vscode.sh
