#!/usr/bin/env bash
# Deploys the application to the server.
#
# Images are built by CI and pulled from GHCR — the server no longer compiles
# anything. Deploys are pinned to a commit SHA, so rolling back is re-running
# this with an older one rather than rebuilding.

set -euo pipefail

TARGET_SERVER="wetjar"
TARGET_BRANCH="main"
TARGET_PATH="/root/portfolio"

BRANCH=${1:-$TARGET_BRANCH}

log(){
  local message="$1"
  echo ">>> $message"
}

git fetch origin "$BRANCH" --quiet
IMAGE_TAG=$(git rev-parse "origin/$BRANCH")

log "Deploying $BRANCH ($(git rev-parse --short "origin/$BRANCH")) to $TARGET_SERVER"

# The repo is still synced because the Caddyfile is bind-mounted from the
# working tree, not baked into an image.
ssh "$TARGET_SERVER" "
  set -euo pipefail
  cd $TARGET_PATH
  git fetch origin $BRANCH
  git reset --hard origin/$BRANCH
  export IMAGE_TAG=$IMAGE_TAG
  docker compose -f docker-compose.prod.yml pull
  docker compose -f docker-compose.prod.yml up -d
"

log "Waiting for the API to come back"
for i in $(seq 1 20); do
  if curl -fsS --max-time 5 https://wetjar.com/api/health > /dev/null; then
    log "Deployment successful."
    exit 0
  fi
  sleep 3
done

log "FAILED: the API did not come back healthy."
exit 1