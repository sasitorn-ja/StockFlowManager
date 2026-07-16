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

# Keep the current container online while the replacement image is building.
# A missing parent snapshot means Docker's build cache is corrupt; rebuild once
# from a clean cache instead of leaving the service stopped.
if ! docker compose build; then
  echo "Initial image build failed. Clearing Docker build cache and retrying once."
  docker builder prune --all --force || true
  docker compose build --no-cache
fi

docker compose up -d --remove-orphans
trap - EXIT
