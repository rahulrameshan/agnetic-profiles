#!/usr/bin/env bash
# This script is used to deploy the application to the server.

set -euo pipefail
# Set variables
TARGET_SERVER="wetjar"
TARGET_BRANCH="main"
TARGET_PATH="/root/portfolio"
DEPLOYMENT_COMMAND="docker compose -f docker-compose.prod.yml up -d --build web"

BRANCH=${1:-$TARGET_BRANCH}


log(){
  local message="$1"
  echo ">>> $message"
}

log "Starting deployment to $TARGET_SERVER on branch $BRANCH"

ssh "$TARGET_SERVER" "cd $TARGET_PATH && git fetch origin $BRANCH && git reset --hard origin/$BRANCH && $DEPLOYMENT_COMMAND"

log "Deployment to $TARGET_SERVER completed successfully."
