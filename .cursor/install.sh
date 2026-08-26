#!/usr/bin/env bash
# Idempotent bootstrap for the judo dev environment (Cloud Agent).
# Installs Node deps (root + server), a Python venv for the crawler/recommender,
# and the Playwright Chromium browser used by the Naver blog crawler.
set -euo pipefail

# Resolve repo root (this script lives in <repo>/.cursor).
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# --- System packages: Python venv support (idempotent) ---
if ! python3 -c "import ensurepip" >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y python3-venv python3-pip
fi

# --- Node dependencies (root + server) ---
# npm ci is deterministic from the committed lockfiles and safe to re-run.
npm ci
npm --prefix server ci

# --- Python environment for the crawler + recommendation pipeline ---
if [ ! -x ".venv/bin/python3" ]; then
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
. .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Playwright Chromium (used by naver_blog_crawler_v2.py). --with-deps pulls in
# the required system libraries; re-running is a no-op once installed.
python -m playwright install --with-deps chromium

echo "judo dev environment ready."
