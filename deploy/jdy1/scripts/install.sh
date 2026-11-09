#!/bin/sh
# jdy1 安装脚本。默认只检查并打印。加上 --apply 才写 Nginx、签证书、起容器。
set -eu

APPLY=0
if [ "${1:-}" = "--apply" ]; then
  APPLY=1
fi

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$ROOT"

DOMAIN="lobe.85718571.xyz"
LOBE_IMAGE="${LOBE_IMAGE:-ghcr.io/goldendecade/lobehub:wq}"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

echo "== 主机 =="
hostname
. /etc/os-release
echo "$PRETTY_NAME"

[ "$(hostname)" = "lavm-jfl5pyc6nq" ] || fail "不是 jdy1（期望主机名 lavm-jfl5pyc6nq）"
command -v docker >/dev/null || fail "没有 docker"
command -v nginx >/dev/null || fail "没有 nginx"

echo "== 端口占用检查 =="
for port in 3210 8788 9000 9989; do
  if ss -lnt | grep -q ":${port} "; then
    fail "端口 ${port} 已被占用"
  fi
done

if ! ss -lnt | grep -q '127.0.0.1:8787'; then
  echo "WARN: 127.0.0.1:8787 当前没有监听。方案仍把 Agent Gateway 放在 9989，不抢 8787。"
fi

echo "== 现有容器（不会被本脚本停止） =="
docker ps --format '{{.Names}} {{.Ports}}'

echo "== 域名解析 =="
if ! getent hosts "$DOMAIN" >/dev/null 2>&1; then
  fail "${DOMAIN} 没有解析。先加 A 记录到 111.228.46.150"
fi
echo "ok ${DOMAIN} -> $(getent hosts "$DOMAIN" | awk '{print $1}')"

if [ "$APPLY" -eq 0 ]; then
  echo
  echo "检查通过。真正安装请运行: bash scripts/install.sh --apply"
  exit 0
fi

echo "== 生成密钥 =="
if [ ! -f .env ]; then
  docker pull "$LOBE_IMAGE"
  LOBE_IMAGE="$LOBE_IMAGE" sh scripts/render-env.sh
fi

echo "== 证书与 Nginx =="
mkdir -p /var/www/certbot
cp -n nginx/00-websocket-map.conf /etc/nginx/conf.d/00-websocket-map.conf

if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  if [ -f "/etc/letsencrypt/live/85718571.xyz/fullchain.pem" ]; then
    echo "检测到已有 *.85718571.xyz 通配符证书，创建软链接复用..."
    mkdir -p /etc/letsencrypt/live
    ln -s /etc/letsencrypt/live/85718571.xyz "/etc/letsencrypt/live/${DOMAIN}"
  else
    echo "先写入 80 端口 ACME 验证配置以签发 ${DOMAIN} 证书..."
    cat > /etc/nginx/conf.d/lobehub.conf <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'ok';
    }
}
EOF
    nginx -t
    nginx -s reload

    certbot certonly --webroot -w /var/www/certbot \
      -d "${DOMAIN}" \
      --agree-tos --register-unsafely-without-email --non-interactive \
      --cert-name "${DOMAIN}"
  fi
fi

cp nginx/lobehub.conf /etc/nginx/conf.d/lobehub.conf
nginx -t
nginx -s reload

echo "== 启动 =="
docker compose pull
docker compose up -d

echo "== 等待应用日志里的 migration =="
i=0
while [ "$i" -lt 60 ]; do
  if docker logs lobehub 2>&1 | grep -q 'database migration pass'; then
    echo "migration ok"
    break
  fi
  i=$((i + 1))
  sleep 5
done

docker ps --filter name=lobe --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo "下一步看 README.md 的健康检查。"
