#!/usr/bin/env bash
set -euo pipefail

INSTALL_PREFIX="${LOBEHUB_CLI_INSTALL_DIR:-$HOME/.lobehub/cli}"
BIN_DIR="${LOBEHUB_CLI_BIN_DIR:-$HOME/.local/bin}"
DEFAULT_TARBALL_URL="https://github.com/GoldenDecade/lobehub/releases/download/wq-cli/lobehub-cli-wq.tgz"
TARBALL_FILE="${LOBEHUB_CLI_TARBALL_FILE:-}"
GITHUB_MIRROR="${LOBEHUB_GITHUB_MIRROR:-}"
TARBALL_URL="${LOBEHUB_CLI_TARBALL_URL:-$DEFAULT_TARBALL_URL}"

log_info() {
  printf '%s\n' "[lobehub-cli] $*"
}

log_warn() {
  printf '%s\n' "[lobehub-cli] WARNING: $*" >&2
}

die() {
  printf '%s\n' "[lobehub-cli] ERROR: $*" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || die "node is required (>= 22.15). Please install Node.js >= 22.15 first."
command -v npm >/dev/null 2>&1 || die "npm is required. Please install Node.js / npm first."

if ! node -e '
  const [maj, min] = process.versions.node.split(".").map(Number);
  if (maj < 22 || (maj === 22 && min < 15)) {
    console.error("Found Node.js v" + process.versions.node + ", require >= 22.15.0");
    process.exit(1);
  }
'; then
  die "Please upgrade Node.js to >= 22.15.0 and re-run."
fi

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/lobehub-cli-install-XXXXXX")"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [ -n "$TARBALL_FILE" ]; then
  [ -f "$TARBALL_FILE" ] || die "LOBEHUB_CLI_TARBALL_FILE does not exist: $TARBALL_FILE"
  LOCAL_TGZ="$TARBALL_FILE"
  log_info "Installing from local tarball: $LOCAL_TGZ"
else
  command -v curl >/dev/null 2>&1 || die "curl is required to download $TARBALL_URL"
  EFFECTIVE_URL="$TARBALL_URL"
  MIRROR_TRIMMED="${GITHUB_MIRROR%/}"
  if [ -n "$MIRROR_TRIMMED" ] && [[ "$EFFECTIVE_URL" == https://github.com/* ]]; then
    EFFECTIVE_URL="${MIRROR_TRIMMED}/${EFFECTIVE_URL}"
  fi
  LOCAL_TGZ="$TMP_DIR/lobehub-cli-wq.tgz"
  log_info "Downloading LobeHub CLI (wq) from $EFFECTIVE_URL"
  curl -fsSL "$EFFECTIVE_URL" -o "$LOCAL_TGZ"
fi

mkdir -p "$INSTALL_PREFIX" "$BIN_DIR"

log_info "Installing into standalone prefix: $INSTALL_PREFIX"
env -u npm_config_prefix -u NPM_CONFIG_PREFIX npm install -g --prefix "$INSTALL_PREFIX" "$LOCAL_TGZ"

for cmd in lh lobe lobehub; do
  target="$INSTALL_PREFIX/bin/$cmd"
  [ -e "$target" ] || die "Expected binary not found after install: $target"
  ln -sf "$target" "$BIN_DIR/$cmd"
done

ensure_path_in_rc() {
  local rc_file="$1"
  local path_expr="$BIN_DIR"
  local already_configured=0

  if [ "$BIN_DIR" = "$HOME/.local/bin" ]; then
    path_expr='$HOME/.local/bin'
  fi

  if [ -f "$rc_file" ]; then
    if grep -Fq "$BIN_DIR" "$rc_file"; then
      already_configured=1
    elif [ "$BIN_DIR" = "$HOME/.local/bin" ] && { grep -Fq '$HOME/.local/bin' "$rc_file" || grep -Fq '~/.local/bin' "$rc_file"; }; then
      already_configured=1
    fi
  fi

  if [ "$already_configured" -eq 1 ]; then
    return 0
  fi

  mkdir -p "$(dirname "$rc_file")"
  {
    if [ -s "$rc_file" ]; then
      printf '\n'
    fi
    printf '# >>> lobehub-wq cli >>>\n'
    printf 'export PATH="%s:$PATH"\n' "$path_expr"
    printf '# <<< lobehub-wq cli <<<\n'
  } >> "$rc_file"
  log_info "Added $path_expr to PATH in $rc_file"
}

if [ -z "${LOBEHUB_CLI_NO_MODIFY_PATH:-}" ]; then
  if [[ "${SHELL:-}" == *zsh ]] || [ -f "$HOME/.zshrc" ]; then
    ensure_path_in_rc "$HOME/.zshrc"
  fi
  if [[ "${SHELL:-}" == *bash ]] || [ -f "$HOME/.bashrc" ]; then
    ensure_path_in_rc "$HOME/.bashrc"
  fi
  if [ "$(uname -s)" = "Darwin" ] && [[ "${SHELL:-}" == *bash ]] && [ ! -f "$HOME/.bashrc" ]; then
    ensure_path_in_rc "$HOME/.bash_profile"
  fi
fi

EXPECTED_REAL="$(node -e 'const fs = require("fs"); console.log(fs.realpathSync(process.argv[1]));' "$BIN_DIR/lh")"

SHADOWS=()
while IFS= read -r candidate; do
  [ -n "$candidate" ] || continue
  cand_real="$(node -e 'const fs = require("fs"); try { console.log(fs.realpathSync(process.argv[1])); } catch {}' "$candidate")"
  if [ -n "$cand_real" ] && [ "$cand_real" != "$EXPECTED_REAL" ]; then
    SHADOWS+=("$candidate -> $cand_real")
  fi
done < <(type -ap lh 2>/dev/null || true)

if [ "${#SHADOWS[@]}" -gt 0 ]; then
  log_warn "Other 'lh' installations exist in PATH and may shadow $BIN_DIR/lh:"
  for item in "${SHADOWS[@]}"; do
    log_warn "  - $item"
    case "$item" in
      *pnpm*) log_warn "    Hint: pnpm remove -g @lobehub/cli" ;;
      *bun*)  log_warn "    Hint: bun remove -g @lobehub/cli" ;;
      *)      log_warn "    Hint: remove it or run: npm uninstall -g @lobehub/cli" ;;
    esac
  done
fi

INSTALLED_VERSION="$("$BIN_DIR/lh" --version)"
"$BIN_DIR/lh" login --help >/dev/null

log_info "Installed successfully!"
log_info "  Version: $INSTALLED_VERSION"
log_info "  Binary:  $BIN_DIR/lh"
log_info "  Prefix:  $INSTALL_PREFIX"

case ":${PATH}:" in
  *":${BIN_DIR}:"*)
    log_info "Run 'lh login' to sign in."
    ;;
  *)
    log_info "Open a new terminal (or run: export PATH=\"$BIN_DIR:\$PATH\") then run 'lh login'."
    ;;
esac
