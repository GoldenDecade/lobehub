#!/bin/sh
# 在 jdy1 的 /opt/lobehub 里运行。生成 .env，已存在则拒绝覆盖。
set -eu

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo ".env 已存在，拒绝覆盖。密钥不能换。" >&2
  exit 1
fi

umask 077

LOBE_IMAGE="${LOBE_IMAGE:-ghcr.io/goldendecade/lobehub:wq}"

key_vaults=$(openssl rand -base64 32)
auth_secret=$(openssl rand -base64 32)
gateway_token=$(openssl rand -hex 32)
pg_password=$(openssl rand -hex 24)
rustfs_access=$(openssl rand -hex 12)
rustfs_secret=$(openssl rand -hex 24)
searx_secret=$(openssl rand -hex 32)

jwks=$(docker run --rm --entrypoint /bin/node "$LOBE_IMAGE" -e 'const c=require("crypto");const {privateKey,publicKey}=c.generateKeyPairSync("rsa",{modulusLength:2048});const meta={alg:"RS256",kid:c.randomBytes(8).toString("hex"),use:"sig"};process.stdout.write("JWKS_KEY="+JSON.stringify({keys:[{...privateKey.export({format:"jwk"}),...meta}]})+"\n");process.stdout.write("JWKS_PUBLIC_KEY="+JSON.stringify({keys:[{...publicKey.export({format:"jwk"}),...meta}]})+"\n")')

jwks_key=$(printf '%s\n' "$jwks" | sed -n 's/^JWKS_KEY=//p')
jwks_public=$(printf '%s\n' "$jwks" | sed -n 's/^JWKS_PUBLIC_KEY=//p')

if [ -z "$jwks_key" ] || [ -z "$jwks_public" ]; then
  echo "JWKS 生成失败。先 docker pull $LOBE_IMAGE 再重试。" >&2
  exit 1
fi

cat > .env <<EOF
LOBE_IMAGE=${LOBE_IMAGE}
LOBE_PORT=3210
RUSTFS_PORT=9000
APP_URL=https://lobe.85718571.xyz
INTERNAL_APP_URL=http://localhost:3210
KEY_VAULTS_SECRET=${key_vaults}
AUTH_SECRET=${auth_secret}
GATEWAY_SERVICE_TOKEN=${gateway_token}
JWKS_KEY='${jwks_key}'
JWKS_PUBLIC_KEY='${jwks_public}'
LOBE_DB_NAME=lobechat
POSTGRES_PASSWORD=${pg_password}
RUSTFS_ACCESS_KEY=${rustfs_access}
RUSTFS_SECRET_KEY=${rustfs_secret}
RUSTFS_LOBE_BUCKET=lobe
S3_ENDPOINT=https://lobe.85718571.xyz
AGENT_GATEWAY_PORT=9989
DEVICE_GATEWAY_PORT=8788
AGENT_GATEWAY_URL=https://lobe.85718571.xyz/agent-gw
DEVICE_GATEWAY_URL=http://gateway:8788
DEVICE_GATEWAY_PUBLIC_URL=https://lobe.85718571.xyz/device-gw
AUTH_ALLOWED_EMAILS=microhealthlab.com,then_0904@qq.com
SEARXNG_SECRET=${searx_secret}
EOF

chmod 600 .env

# searxng 只接受自己的 settings 文件里的 secret，不读 .env。
if grep -q 'CHANGE_ME_AT_INSTALL' searxng-settings.yml; then
  sed -i "s/CHANGE_ME_AT_INSTALL/${searx_secret}/" searxng-settings.yml
fi

echo ".env 已生成，权限 600。不要复制出去。"
