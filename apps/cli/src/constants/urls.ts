import { OFFICIAL_DEVICE_GATEWAY_URL, OFFICIAL_URL } from '@lobechat/const';

export { OFFICIAL_AGENT_GATEWAY_URL } from '@lobechat/const';

export const OFFICIAL_SERVER_URL = OFFICIAL_URL;
export const OFFICIAL_GATEWAY_URL = OFFICIAL_DEVICE_GATEWAY_URL;

/**
 * Default server and agent gateway URLs for this private (`wq`) distribution.
 * Overridable at runtime via `LOBEHUB_SERVER` / `AGENT_GATEWAY_URL` or `~/.lobehub/settings.json`.
 */
export const DEFAULT_SERVER_URL = 'https://lobe.85718571.xyz';
export const DEFAULT_AGENT_GATEWAY_URL = 'https://lobe.85718571.xyz/agent-gw';
export const IS_PRIVATE_CLI_DISTRIBUTION =
  (DEFAULT_SERVER_URL as string) !== (OFFICIAL_SERVER_URL as string);

/**
 * Rolling GitHub Release feed for cross-machine `lh update` on the `wq` distribution.
 * Overridable via `LOBEHUB_CLI_RELEASE_MANIFEST_URL` or `LOBEHUB_GITHUB_MIRROR`.
 */
export const DEFAULT_CLI_RELEASE_REPO = 'GoldenDecade/lobehub';
export const DEFAULT_CLI_RELEASE_TAG = 'wq-cli';
export const DEFAULT_CLI_RELEASE_MANIFEST_URL = `https://github.com/${DEFAULT_CLI_RELEASE_REPO}/releases/download/${DEFAULT_CLI_RELEASE_TAG}/latest.json`;
export const DEFAULT_CLI_RELEASE_TARBALL_URL = `https://github.com/${DEFAULT_CLI_RELEASE_REPO}/releases/download/${DEFAULT_CLI_RELEASE_TAG}/lobehub-cli-wq.tgz`;
