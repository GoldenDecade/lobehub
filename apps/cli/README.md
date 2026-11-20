# @lobehub/cli

LobeHub command-line interface.

## Private `wq` Distribution（`lh` 安装、包管理器建议与旧版清理）

本分支（`wq`）面向私有化部署 `https://lobe.85718571.xyz` 构建私有版 `@lobehub/cli`（包含默认私有服务端、裸域名解析、`GoldenDecade/lobehub@wq-cli` 滚动更新源及跨 Node 版本固定安装前缀支持）。

### 1. 包管理器与安装方式建议

- **唯一推荐方式**：使用本仓随 `wq-cli` Release 发布的独立安装脚本 [`apps/cli/scripts/install-wq.sh`](./scripts/install-wq.sh)，将 CLI 安装到与 Node 版本无关的独立前缀 **`~/.lobehub/cli`**（底层调用 `npm install -g --prefix ~/.lobehub/cli`），并将 `lh`、`lobe`、`lobehub` 软链到 **`~/.local/bin`**。
- **环境要求**：Node.js `>= 22.15`、`npm`、`curl`。
- **仓库开发 vs CLI 安装分工**：本仓库日常研发与打包脚本使用 `bun` / `pnpm`（例如 `bun run wq`）；但终端里的 **`lh` CLI 本体只走独立前缀 `~/.lobehub/cli` 安装**，禁止混用以下全局安装方式：
  - **不要用 `npm install -g @lobehub/cli`（无 `--prefix` 或直接装官方包）**：
    1. 公网 npm 装的是官方云端版，默认连 `https://app.lobehub.com` 而非私有域 `https://lobe.85718571.xyz`；
    2. 不带独立 `--prefix` 时，npm 会把 `lh` 装进当前 `fnm` / `nvm` 的 Node 版本目录（例如 `v22.23.1`），一旦进入带 `.nvmrc`（本仓为 `lts/krypton`）的目录或重启打开新终端，就会出现 `zsh: command not found: lh`。
  - **不要用 `pnpm add -g @lobehub/cli`**：`pnpm` 会在 `$PNPM_HOME/bin`（如 `~/Library/pnpm/bin`）留下高优先级 shim 遮蔽新版，且 pnpm 主版本升级后（如 v11 → v12）`pnpm list -g` / `pnpm remove -g` 可能看不到旧版遗留目录。
  - **不要用 `yarn global add` 或 `bun add -g` 混装**：与 `npm` 独立前缀并存时同样会造成 `PATH` 遮蔽与升级目标混乱。

### 2. 旧版 `lh` 与遮蔽路径彻底清理（新老电脑先执行）

在全新安装或排查 “域名不对 / 版本不对 / 重启后找不到命令” 之前，先检查并清掉所有旧安装和 `PATH` 遮蔽：

```bash
# 1. 查看当前 PATH 下所有 lh 入口与真实指向
which -a lh
ls -la $(which -a lh 2>/dev/null) 2>/dev/null || true

# 2. 清理 npm 全局安装（如使用 fnm，同步检查每个 Node 版本目录）
npm uninstall -g @lobehub/cli || true
ls -la ~/.local/share/fnm/node-versions/*/installation/bin/lh 2>/dev/null || true
# 如上面查到某个版本（如 v22.23.1）残留 lh，按其安装前缀卸载：
# npm uninstall -g --prefix ~/.local/share/fnm/node-versions/v22.23.1/installation @lobehub/cli

# 3. 清理 pnpm 全局安装（含 pnpm v11 遗留孤儿 shim）
pnpm remove -g @lobehub/cli || true
rm -f ~/Library/pnpm/bin/lh ~/Library/pnpm/bin/lobe ~/Library/pnpm/bin/lobehub \
  ~/.local/share/pnpm/lh ~/.local/share/pnpm/lobe ~/.local/share/pnpm/lobehub
# 如 ~/Library/pnpm/global/v11/ 下仍有只含 @lobehub/cli 的孤儿目录，检查 package.json 确认后一并删除

# 4. 清理 bun / yarn 全局安装（如有）
bun remove -g @lobehub/cli || true
yarn global remove @lobehub/cli || true
```

同时检查 shell 配置文件（`~/.zshrc`、`~/.zprofile`、`~/.bashrc`、`~/.bash_profile`）：

- 若此前手动把桌面端内嵌 CLI 目录（例如 `export PATH="$HOME/Library/Application Support/LobeHub-WQ/bin:$PATH"` 或 `LobeHub/bin`）写进过全局 `PATH`，**请删除该配置**。桌面端在内部拉起外部 Agent 时会通过 `withEmbeddedCliEnv` 自动注入内嵌 CLI，不需要也不能放到全局 shell `PATH` 前面，否则会遮蔽终端 `lh` 并导致 `lh update` 失效。

### 3. `lh`（`wq` 私有版）安装、登录与升级

```bash
# 方式 A：GitHub 直连一键安装（推荐）
curl -fsSL https://github.com/GoldenDecade/lobehub/releases/download/wq-cli/install.sh | bash

# 方式 B：国内网络通过镜像前缀安装（可选）
curl -fsSL https://ghfast.top/https://github.com/GoldenDecade/lobehub/releases/download/wq-cli/install.sh | LOBEHUB_GITHUB_MIRROR=https://ghfast.top bash

# 方式 C：从本地已打包的 .tgz 安装（仓库内 bun run wq 会自动复用同一安装器）
LOBEHUB_CLI_TARBALL_FILE=/path/to/lobehub-cli-wq.tgz bash apps/cli/scripts/install-wq.sh
```

安装脚本会自动幂等写入 `~/.local/bin` 到 shell `PATH`（如需跳过修改 rc 文件可传 `LOBEHUB_CLI_NO_MODIFY_PATH=1`），并在结束时检测是否仍有旧版 `lh` 遮蔽。

安装完成后刷新 shell 并登录：

```bash
exec $SHELL -l
lh login
# 也支持传入裸私有域名（自动补全 https://）：lh login --server lobe.85718571.xyz
# 如旧电脑 ~/.lobehub/settings.json 曾保存过 https://app.lobehub.com，首次请显式执行一次：
# lh login --server https://lobe.85718571.xyz

# 如需守护进程连接本机：
lh connect --daemon
```

日常升级（`lh update` 会自动识别 `~/.lobehub/cli` 并固定 `--prefix` 原地升级，切到任何 Node 版本目录下都不会装偏）：

```bash
lh update
# 国内网络可加镜像：
LOBEHUB_GITHUB_MIRROR=https://ghfast.top lh update
```

### 4. 验收命令清单

```bash
which -a lh          # 应仅指向 ~/.local/bin/lh（软链至 ~/.lobehub/cli/bin/lh）
lh --version         # 应显示 <version>-wq.<timestamp>
lh login --help      # 默认 --server 应为 https://lobe.85718571.xyz
lh update --check    # 应命中 wq-cli 源而非公网 npm
lh doctor            # cli install 应无遮蔽告警，endpoint resolution 指向 https://lobe.85718571.xyz
lh whoami            # 确认当前登录账号与服务器身份正常
```

## Release to npm

The `Release CLI` GitHub Actions workflow publishes to npm's `latest` tag when
CLI production inputs change on `canary`. Merge the feature or fix PR after its
checks and required product acceptance; no separate version-bump PR is needed.

Automatic inputs are `apps/cli/src/**`, build scripts, `package.json`, the CLI
workspace/TypeScript/tsdown configuration, and the release workflow/helper.
Tests, fixtures, Markdown documentation, E2E-only changes and generated manuals
are excluded. Changes only to shared workspace packages or the offline report
can be released by manually dispatching `Release CLI` on `canary`.

CI allocates the next patch above the highest stable npm version (for example,
`0.0.78` → `0.0.79`). A higher stable version intentionally set in `package.json`
is honored for a minor/major release. The generated version is used for the
bundle and manual; CI does not commit version changes back to the branch. The
checked-in version is therefore a development baseline, not necessarily npm's
latest release. Use `npm view @lobehub/cli version` to check the published version.

The workflow tests the bundle, runs the complete `prepublishOnly` build, checks
the built CLI and packs it. Immediately before publication it creates a
`cli-release/v<version>` Git tag pointing at the source commit. The tag reserves
the version for retries; the published package also records `gitHead`.
Publication is serialized and the workflow waits up to ten minutes for npm to
expose the matching version/source under `latest`. A successful upload alone is
not reported as a verified publication.

Use **Re-run failed jobs** on the original run to recover a failed publication.
A retry reuses its reserved version or skips it if already published. If npm is
still processing an earlier reserved release, a different commit's release stops
with a recovery message instead of allocating another version. Older reruns do
not publish over newer source commits. Build/test failures before reservation
can be fixed by the next PR normally. Do not delete reservation tags to retry a
release. Registry errors stop the workflow.

GitHub may coalesce queued runs while another release is running; the surviving
newer commit includes the earlier merged changes. This publishes source snapshots,
not necessarily one version per merged PR.

Publishing uses the repository's `NPM_TOKEN` secret, as the SDK release does.
It must have publish permission for `@lobehub/cli` and support unattended
publishing under the package's npm authentication policy. PR previews continue
to publish separately to `pkg.pr.new`.

## Update a connected device

```bash
lh update                  # Install the latest CLI without restarting a connector
lh connect status          # Connection, running version, and any required action
lh connect status --verbose # Service metadata and CLI installation paths

# Wait for active tasks to finish, then restart the detected connector:
lh connect restart
lh connect status          # Verify the new running version and connection
```

Installing an update and activating it are separate steps. `lh update` keeps the
running connector in place; it reports the installed and running versions separately.
Restarting disconnects the device and closes its remote terminals. A terminal
provided by LobeHub may close or print `Terminated` before the restart request
returns. Reconnect before checking status; “Restart requested” is not confirmation
that the device is already connected.

`lh connect restart` detects a CLI daemon or a user/system systemd service. System
services use `sudo` unless already running as root. When multiple connectors are
running, select one with `--manager daemon`, `--manager user`, or `--manager system`.
Service restarts preserve the unit's configuration; daemon connection flags such
as `--token` cannot override it. `lh connect service restart` remains a user-service
alias. With no managed connector and no inspection failures, `lh connect restart`
retains its existing behavior of starting a daemon. Daemon restarts wait for the
previous process to exit before starting its replacement, including when upgrading
from an older CLI. If shutdown times out, no replacement is started.

A daemon cannot be restarted from a terminal or shell it owns: its shutdown would
kill the waiting restart command. This is rejected before stopping the connection;
run `lh connect restart` from a local terminal or an independent SSH session instead.
If process ancestry cannot be verified, the restart is also rejected without
stopping the connector. Systemd service restarts still use the service manager.

If an older restart lost `daemon.pid`, `lh connect status` can recover it from the
status record only after verifying that the process is alive and is a daemon, not
a foreground connection or systemd service. This recovery does not restart the
connection. Cleanup checks PID ownership; normal restarts also wait for the old
process to exit before creating new records.

If the version still differs after a restart, the status report shows the command's
CLI entry path and the connector's entry path when available. Different paths mean
you should update the connector's installation or change its service configuration.
Diagnostics never dump the service's command line or environment. Older connectors
on Linux use a conservative `/proc` lookup; an inaccessible or unsupported entry
is reported as unknown instead of guessed.

## Managed cloud devices

A managed cloud device is a device that LobeHub creates and runs for you. The
platform that runs it starts the agent with:

```bash
lh connect --managed
```

Managed mode reads everything from the environment. It does not use a stored
login, a keychain or a browser, and it writes no credentials to disk, so it runs
headless in a container. `lh connect service install` is not needed: the
platform supervises the process and restarts it when it exits.

| Variable                          | Required | Meaning                                                     |
| --------------------------------- | -------- | ----------------------------------------------------------- |
| `LOBEHUB_MANAGED_DEVICE_ID`       | yes      | The device id. It replaces the id derived from the machine. |
| `LOBEHUB_MANAGED_DEVICE_SECRET`   | yes      | The bootstrap secret. The CLI never prints it.              |
| `LOBEHUB_SERVER`                  | yes      | The LobeHub server URL.                                     |
| `LOBEHUB_DEVICE_GATEWAY_URL`      | yes      | The device gateway URL.                                     |
| `LOBEHUB_DEVICE_ACTIVITY_COMMAND` | no       | A JSON array: a command to run while the device does work.  |

If a required variable is missing, the CLI names it and exits with status 1.
`LOBEHUB_SERVER` and `LOBEHUB_DEVICE_GATEWAY_URL` must use `https`; `http` is
accepted only for `localhost` and the loopback addresses `127.0.0.0/8` and
`::1`. The URLs must not contain a user name, a password, a query or a fragment.
A path is kept, so `https://example.com/lobehub` sends the token request to
`https://example.com/lobehub/api/device/managed/token`. `--managed` cannot be used
with `--token`, `--gateway`, `--device-id`, `--workspace`, `--public` or
`--daemon`.

After the CLI reads the secret, it removes it from its own environment, so the
processes it starts (tool calls, agent runs) do not inherit it. This does not
hide the secret from the device: other processes of the same user can still
read the environment the CLI started with (for example `/proc/<pid>/environ`).
The secret only gets tokens for this device, and it stops working when the
device is deleted.

**Token.** The CLI sends `POST {LOBEHUB_SERVER}/api/device/managed/token` with
`{ "deviceId", "secret" }` and gets `{ "token", "expiresAt" }`, where
`expiresAt` is an RFC 3339 time with `Z` or an offset. The token's
`workspace_id` claim, when present, makes the device a workspace device;
otherwise its `sub` is the owning user.

- The CLI gets a new token when 80% of the token's lifetime has passed (at least
  5 s after it got the previous one). The open gateway connection stays up:
  only the next connection uses the new token, so running tool calls, agent
  runs and tunnels continue.
- On HTTP 408, 429 or 5xx, a network error or an unreadable response, the CLI
  tries again after 1 s, then 2 s, 4 s and so on, up to 60 s between attempts
  (each delay ±20%). It continues until the server answers.
- On HTTP 401 (wrong secret, or the device was deleted), 404 (the server has no
  managed cloud devices) or another 4xx, the CLI exits with status 1.
- If the gateway rejects a token, the CLI gets a new token and connects again.
  If the gateway also rejects that token before a connection succeeds, the CLI
  exits with status 1.

**Activity command.** When `LOBEHUB_DEVICE_ACTIVITY_COMMAND` is set, the CLI runs
it while the device serves a tool call, an RPC, an agent run or an open tunnel.
It runs when the work starts and then every 30 s while work continues, never
more than once in 30 s and never two at a time. The work does not wait for it.
A run that takes longer than 10 s is stopped. Failures appear only in the debug
log (`--verbose`).

The value is a JSON array of strings: the program, then its arguments, for
example `["my-agent","touch"]`. The CLI runs the program directly, without a
shell, so there is no quoting, `$VAR`, `~` or glob expansion, and `|`, `;`, `&`,
`>` and `<` are ordinary characters. If the value is not a non-empty JSON array
of non-empty strings, the CLI exits with status 1 at startup. To use shell
features, give an explicit shell, for example
`["sh","-c","my-agent touch >> /var/log/activity"]`. When the CLI stops, it
also stops a command that is still running.

## Publish local artifacts

```bash
# Publish ordinary HTML and its referenced local resources
lh artifact publish ./page.html --root . --json

# Read the Canvas component and generation rules
lh artifact guide canvas

# Publish a self-contained Canvas HTML file
lh artifact publish ./report.html --type canvas --json

# The binding remembers the type; subsequent publishes update the same artifact
lh artifact publish ./report.html --json

# Create a separate Canvas and bind future publishes to it
lh artifact publish ./report.html --new --json

# Take a published artifact offline (the deployment and its releases are kept)
lh artifact unpublish ./report.html --json
```

Bindings and pending operations live in the project's `.lobehub/artifacts.json`.
Retry the same command with unchanged input after a failed Canvas save or publish;
the CLI resumes that operation without creating another Canvas or saved version.
Restore the original input before retrying if you edited it during recovery.
An explicit validation or version-conflict rejection releases the pending save,
so you can correct the file or inspect the latest version before trying again.
If publication explicitly rejects a slug, correct `--slug` and retry with the same
content and target; the CLI reuses the saved Canvas and version.
Canvas bindings are scoped to the authenticated account, server and workspace.

Canvas input is a single HTML file with inline styles, scripts and data, subject
to the Canvas guide's validation and size limits. Publication saves a version in
LobeHub and returns a public URL; it requires a server with Canvas publishing and
a compatible runtime. JSON errors retain any saved Canvas ID and version.

`--slug <name>` requests the readable prefix for a new deployment. Market adds an
eight-character suffix; both HTML and Canvas use the same rule. Existing deployments
retain their address when updated, including older records without a stored label.
JSON `publicUrl` is the direct hosting URL; `shareUrl` is the LobeHub product share
page, and `subdomainLabel` is the actual assigned label when the server returns it.

`--deployment <id>` overrides the deployment for this run without changing the
canonical binding. `--new` and `--deployment` cannot be combined. Changing an
existing artifact's content type requires `--new`.

## Acceptance skill

The acceptance skill is maintained in [lobehub/acceptance](https://github.com/lobehub/acceptance).
Install from the repository's default branch:

```bash
lh acceptance install
```

Update the installed skill:

```bash
lh acceptance update
```

Publishing reports to LobeHub requires authentication (`lh login`). Without a
login, acceptance runs locally — see [Local reports](#local-reports).

This selects the same source as `npx skills add lobehub/acceptance --skill acceptance`.
Changes merged into the default branch are available on the next install or
update, without a tag, GitHub Release, or skill-version bump. Installed files
remain unchanged until you run an update.

`install` skips existing files unless `--force` is passed. `update` replaces the
materialized files in `.agents/skills/acceptance`, removes stale resources, and
maintains agent links. The server resolves a commit and downloads the entire
skill from that snapshot before files are changed. `--json` reports the exact
source commit and the version declared in `SKILL.md`; that version is a label,
not the selector for default updates.

Use an up-to-date CLI and LobeHub server. Older servers may return `401` during
installation and need to be upgraded.

To select an existing version tag explicitly, use `lh acceptance update --skill-version 0.5.0` (requires the updated CLI and server), or the equivalent
[tagged skill source](https://github.com/lobehub/acceptance/tree/v0.5.0/skills/acceptance)
with `npx skills add`. A later `lh acceptance update` without `--skill-version`
returns to the current default-branch source.

## Local reports

A machine that has never signed in renders acceptance reports locally instead
of publishing them; `lh acceptance preflight --json` reports `"mode": "local"`.

```bash
lh acceptance run render .acceptances/<subject>/<round> --requirement "<business goal>"
```

This writes `report.html` beside the rounds: the acceptance page, offline — the
checklist, evidence, before/after pairs, video chapters and round history,
rendered from every round of that acceptance. Nothing is uploaded. The reader
can accept or reject checks and circle regions on screenshots there; **Save
reviews** downloads the decisions, and the next
`lh acceptance feedback .acceptances/<subject>` (or `view`) files them as
`reviews.json` and reports them like hosted feedback.

Comments, mentions and shared links need LobeHub. After `lh login`,
`lh acceptance publish .acceptances/<subject>` publishes the unpublished rounds
in order into one acceptance and carries the standing review decisions over;
running it again publishes only newer rounds.

The page is built by `apps/workbench` (`bun run --cwd ../workbench build:report`);
`bun run build` copies it to `dist/acceptance-report.html` when it exists.

## Local Development

| Task                                       | Command                    |
| ------------------------------------------ | -------------------------- |
| Run in dev mode                            | `bun run dev -- <command>` |
| Build the CLI                              | `bun run build`            |
| Link `lh`/`lobe`/`lobehub` into your shell | `bun run cli:link`         |
| Remove the global link                     | `bun run cli:unlink`       |

- `bun run build` generates `dist/index.js`, plus `dist/acceptance-report.html` when the local report page is built.
- To make `lh` available in your shell, run `bun run cli:link`.
- After linking, if your shell still cannot find `lh`, run `rehash` in `zsh`.

## Custom Server URL

By default the CLI connects to `https://app.lobehub.com`. To point it at a different server (e.g. a local instance):

| Method               | Command                                                         | Persistence                         |
| -------------------- | --------------------------------------------------------------- | ----------------------------------- |
| Environment variable | `LOBEHUB_SERVER=http://localhost:4000 bun run dev -- <command>` | Current command only                |
| Login flag           | `lh login --server http://localhost:4000`                       | Saved to `~/.lobehub/settings.json` |

Priority: `LOBEHUB_SERVER` env var > `settings.json` > default official URL.

## Shell Completion

### Install completion for a linked CLI

| Shell  | Command                        |
| ------ | ------------------------------ |
| `zsh`  | `source <(lh completion zsh)`  |
| `bash` | `source <(lh completion bash)` |

### Use completion during local development

| Shell  | Command                                      |
| ------ | -------------------------------------------- |
| `zsh`  | `source <(bun src/index.ts completion zsh)`  |
| `bash` | `source <(bun src/index.ts completion bash)` |

- Completion is context-aware. For example, `lh agent <Tab>` shows agent subcommands instead of top-level commands.
- If you update completion logic locally, re-run the corresponding `source <(...)` command to reload it in the current shell session.
- Completion only registers shell functions. It does not install the `lh` binary by itself.

## Quick Check

```bash
which lh
lh --help
lh agent <TAB>
```

## Tests

The default `test` and `test:coverage` scripts run offline unit tests only. Live
E2E uses a separate config and never replaces or removes your selected CLI home.
It always runs this checkout's `dist/index.js`, not a globally installed `lh` or
a caller-supplied `LH_CLI_PATH`.

From `apps/cli`, prepare a dedicated test account (never your everyday account):

```bash
bun run build
export LOBEHUB_CLI_HOME=.lobehub-e2e
export LOBEHUB_SERVER=https://your-test-server.example
node dist/index.js login --server "$LOBEHUB_SERVER"
node dist/index.js whoami

# Explicitly authorize real writes for this test account/server.
export LOBEHUB_E2E_ALLOW_WRITES=1
bun run test:e2e e2e/model.e2e.test.ts --testTimeout=60000 --hookTimeout=60000
```

Without a selected home, server, write opt-in, built CLI, or valid authentication,
the live setup fails before fixture creation. A directory name does not itself
isolate server data: sign in with a dedicated test identity. Model tests own a
temporary provider, including the remote-model clearing case. Other suites may
create data or consume model credits, so do not run them on a personal account.
Collection alone (`bunx vitest list --config vitest.e2e.config.mts`) needs no login.
Signal and VFS tests additionally require their documented Agent ID variables.
Search fixtures wait up to 60 seconds for asynchronous indexing; a timeout fails
the suite rather than accepting empty results. The command above supplies a live
network budget explicitly; this does not change unit-test timeouts or enable retries.

### Native Codex app-server on a connected device

A current CLI advertises `codex-app-server-v1` only after its resolved Codex binary
completes a native app-server handshake. The probe runs once per gateway connection
(and again after 10 minutes), not once per system-info request. `lh connect capabilities`
reports that same capability as JSON without logging in, connecting a device, or creating
a conversation. Desktop gateway connections invoke this command through their bundled
CLI, so an unrelated global CLI cannot determine support. Missing, incompatible, or
timed-out binaries do not advertise native support.

Codex topics run through `codex exec` unless the user enables the
**Codex App Server Runtime** Lab. With the Lab on and a capable connection, the server
runs them through app-server and persists each message's native session and turn IDs.
These topics keep the `codex exec` recovery: a missing native session is retried fresh
with the topic transcript.

The internal `lh hetero exec --codex-app-server` transport uses a per-operation process
that owns cancellation and shell identity. This transport rejects unsupported approval
or sandbox arguments instead of weakening permissions. The richer permission bridge is
maintained separately.
