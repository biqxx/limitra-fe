#!/bin/sh
set -eu

cd /opt/platform/apps/limitra-fe
docker compose -f compose.production.yml pull frontend
docker compose -f compose.production.yml up -d --remove-orphans frontend
docker compose -f compose.production.yml ps frontend
