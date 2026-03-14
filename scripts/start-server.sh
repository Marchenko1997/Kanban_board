#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PORT="${PM_PORT:-8080}"

cd "${REPO_ROOT}"
docker compose up --build -d
echo "Server started at http://localhost:${PORT}"
