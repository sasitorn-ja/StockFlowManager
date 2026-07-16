#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PROJECT_DIR=$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)

show_diagnostics() {
  status=$?
  echo "Deployment failed with exit code ${status}."
  echo "Disk usage:"
  df -h || true
  echo "Docker compose services:"
  docker compose ps || true
  echo "Recent container logs:"
  docker compose logs --tail=120 || true
  exit "$status"
}

trap show_diagnostics EXIT

cd "$PROJECT_DIR"
docker compose pull --ignore-buildable || true
docker compose down
docker compose up -d --build
trap - EXIT
