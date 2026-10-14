#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."
exec uv run --with pillow==12.3.0 branding/generate-icons.py
