#!/bin/sh
# 自动检测 wq 镜像是否有新版本：
# - 无更新时：pull 1秒结束，up -d 不会重启容器
# - 有更新时：拉取新层并平滑重建 lobehub 容器，同时清理旧的悬空镜像
set -eu

cd /opt/lobehub

before_id=$(docker inspect --format '{{.Image}}' lobehub 2>/dev/null || true)
docker compose pull -q lobe
docker compose up -d lobe
after_id=$(docker inspect --format '{{.Image}}' lobehub 2>/dev/null || true)

if [ -n "$before_id" ] && [ "$before_id" != "$after_id" ]; then
  echo "[$(date '+%F %T')] lobehub updated: ${before_id} -> ${after_id}"
  docker image prune -f >/dev/null 2>&1 || true
fi

