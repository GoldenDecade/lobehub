# jdy1 私有化部署方案（单域名 `lobe.85718571.xyz` + `wq` 分支镜像）

目标机器：`ssh jdy1`（`111.228.46.150`，CentOS 8，Docker 26.1.3，Compose v2.27.0）。

**本目录只是方案，还没有在服务器上执行。** 不要在这台机器上跑官方 `setup.sh`，它会把 Postgres 绑到宿主机 5432、把 Agent Gateway 绑到 8787。

## 这台机器上已经确认的事实

| 项                                 | 现状                                                               |
| ---------------------------------- | ------------------------------------------------------------------ |
| 内存                               | 15G，可用约 9.8G，无 swap                                          |
| 磁盘                               | `/` 270G，已用 24G，剩余 247G                                      |
| Nginx                              | 1.20.0，已听 `0.0.0.0:80` 和 `443`                                 |
| 证书                               | 已有 `*.85718571.xyz`（astrbot）和 `*.microhealthlab.com`          |
| `127.0.0.1:8787`                   | `pico-wecom-bridge`，反代 `pico.microhealthlab.com`。不能占用      |
| `0.0.0.0:5432`                     | 现有 `postgres:15` 容器，只在 Docker 网络内。不能再映射宿主机 5432 |
| `3210` `8788` `9000` `9001` `9989` | 当前空闲                                                           |
| LobeHub                            | 未安装。没有 `/opt/lobehub`                                        |

现有站点不要改：`astrbot.85718571.xyz`、`openconnector.85718571.xyz`、`vik.85718571.xyz`、`pico.microhealthlab.com`、`files.microhealthlab.com`、`uat-app.microhealthlab.com`、`pay.looplife.me`、`wj.looplife.me`、`uat-wq.microhealthlab.com`、`wq.looplife.me`。

## 单域名路由设计（对外只需 `lobe.85718571.xyz` 1 个域名）

| 用途               | 对外 URL                              | Nginx 反代目标   | 说明                                                         |
| ------------------ | ------------------------------------- | ---------------- | ------------------------------------------------------------ |
| 主站应用           | `https://lobe.85718571.xyz/`          | `127.0.0.1:3210` | Web / Desktop 登录                                           |
| Agent Gateway      | `https://lobe.85718571.xyz/agent-gw`  | `127.0.0.1:9989` | 剥离 `/agent-gw` 前缀 + WebSocket                            |
| Device Gateway     | `https://lobe.85718571.xyz/device-gw` | `127.0.0.1:8788` | 剥离 `/device-gw` 前缀 + WebSocket                           |
| 对象存储（RustFS） | `https://lobe.85718571.xyz/lobe/*`    | `127.0.0.1:9000` | `S3_ENABLE_PATH_STYLE=1`，保留 `/lobe/` 路径与 Host 签名一致 |

## 端口对照

| 服务           | 容器内 | 宿主机           | 说明                       |
| -------------- | ------ | ---------------- | -------------------------- |
| LobeHub        | 3210   | `127.0.0.1:3210` | 只给 Nginx                 |
| Agent Gateway  | 8787   | `127.0.0.1:9989` | 避开微信桥的 8787          |
| Device Gateway | 8788   | `127.0.0.1:8788` | Claude Code / `lh connect` |
| RustFS         | 9000   | `127.0.0.1:9000` | 浏览器同源 `/lobe/` 上传   |
| RustFS 控制台  | 9001   | 不映射           |                            |
| Postgres       | 5432   | 不映射           | 避开现有 postgres 容器     |
| Redis          | 6379   | 不映射           |                            |

容器之间走 compose 网络：`AGENT_GATEWAY_INTERNAL_URL=http://gateway:8787`，不要改成 9989。

## 安装顺序（确认 `lobe.85718571.xyz` 解析之后）

在**这台 Mac** 上：

```bash
cd /Users/wangqiang506/Desktop/github/lobehub
rsync -a --exclude '.env' deploy/jdy1/ jdy1:/opt/lobehub/
```

在 **jdy1** 上，先检查，再安装：

```bash
ssh jdy1
cd /opt/lobehub
bash scripts/install.sh
bash scripts/install.sh --apply
```

装完在 jdy1 上做健康检查：

```bash
curl -fsS http://127.0.0.1:3210 >/dev/null && echo app-ok
curl -fsS http://127.0.0.1:9989/health
curl -fsS http://127.0.0.1:8788/health
curl -fsS https://lobe.85718571.xyz >/dev/null && echo web-ok
curl -fsS https://lobe.85718571.xyz/agent-gw/health
curl -fsS https://lobe.85718571.xyz/device-gw/health
docker logs lobehub 2>&1 | tail -30
```

## 客户端机器安装与维护 `lh` CLI（`wq` 私有版）

因为服务端已配置 `DEVICE_GATEWAY_PUBLIC_URL=https://lobe.85718571.xyz/device-gw`，客户端会自动发现网关地址。完整说明见 [apps/cli/README.md](../../apps/cli/README.md)。

### 1. 包管理器建议

- **唯一推荐**：使用 `wq-cli` 独立安装脚本安装到固定前缀 `~/.lobehub/cli` 并软链至 `~/.local/bin`（底层调用 `npm install -g --prefix ~/.lobehub/cli`），要求 Node.js `>= 22.15`。
- **禁止直接全局安装**：不要用 `npm install -g @lobehub/cli`、`pnpm add -g @lobehub/cli`、`bun add -g @lobehub/cli` 或 `yarn global add`。直接装公网包会默认连 `https://app.lobehub.com`，且不带独立 `--prefix` 会绑定到当前 `fnm`/`nvm` Node 版本目录（进仓库触发 `.nvmrc` 或重启后即 `command not found`），`pnpm` 还会在 `$PNPM_HOME/bin` 留下高优先级遮蔽 shim。

### 2. 清理旧版 `lh` 与遮蔽路径（另一台电脑或老环境先执行）

```bash
# 查看现有 lh 来源
which -a lh
ls -la $(which -a lh 2>/dev/null) 2>/dev/null || true

# 清理 npm（含 fnm 各版本目录）/ pnpm（含 v11 孤儿 shim）/ bun / yarn 全局残留
npm uninstall -g @lobehub/cli || true
ls -la ~/.local/share/fnm/node-versions/*/installation/bin/lh 2>/dev/null || true
# 若发现某个 fnm 版本（如 v22.23.1）存在残留，执行：
# npm uninstall -g --prefix ~/.local/share/fnm/node-versions/<version>/installation @lobehub/cli

pnpm remove -g @lobehub/cli || true
rm -f ~/Library/pnpm/bin/lh ~/Library/pnpm/bin/lobe ~/Library/pnpm/bin/lobehub \
  ~/.local/share/pnpm/lh ~/.local/share/pnpm/lobe ~/.local/share/pnpm/lobehub
bun remove -g @lobehub/cli || true
yarn global remove @lobehub/cli || true
```

同时检查 `~/.zshrc` / `~/.zprofile` / `~/.bashrc`，**移除**任何手动前置 `LobeHub-WQ/bin` 或 `LobeHub/bin` 到 `PATH` 的配置（桌面端内嵌运行会自动注入，不应覆盖全局终端 `lh`）。

### 3. 一键安装、登录与日常更新

```bash
# GitHub 直连安装
curl -fsSL https://github.com/GoldenDecade/lobehub/releases/download/wq-cli/install.sh | bash

# 国内网络镜像安装（可选）
curl -fsSL https://ghfast.top/https://github.com/GoldenDecade/lobehub/releases/download/wq-cli/install.sh | LOBEHUB_GITHUB_MIRROR=https://ghfast.top bash
```

重新加载 shell 后登录并连入设备：

```bash
exec $SHELL -l
lh login                 # 默认即 https://lobe.85718571.xyz（若旧配置残留 app.lobehub.com，加 --server https://lobe.85718571.xyz）
lh connect --daemon
```

日常升级与验收：

```bash
lh update                # 自动按 ~/.lobehub/cli 原地升级，不受切换 Node 版本影响
which -a lh
lh --version
lh login --help
lh doctor
lh whoami
```
